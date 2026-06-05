import { useState, useContext, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Minus, Plus, ClipboardList, Warehouse } from 'lucide-react';
import { differenceInDays, parseISO, format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { AuthContext } from '@/lib/authContext';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { getBatchesForWarehouse } from '@/lib/inventory';
import type { Bean, InventoryTransaction, Warehouse as WarehouseType } from '@/types';
// Bean + InventoryTransaction used as local variables inside startCount

/* ── 新鮮度徽章 ─────────────────────────────────────── */
function FreshBadge({ roastDate }: { roastDate: string }) {
  const days = differenceInDays(new Date(), parseISO(roastDate));
  if (days <= 10) return (
    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-cafe-accent text-cafe-dark">
      養豆中
    </span>
  );
  if (days > 180) return (
    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-cafe-primary text-cafe-cream">
      滿六個月
    </span>
  );
  return (
    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
      正常
    </span>
  );
}

/* ── 盤點列資料結構 ───────────────────────────────────── */
interface CheckRow {
  beanId: string;
  beanName: string;
  roastDate: string;
  systemQty: number;
  actualQty: number | ''; // '' = 未填
}

type Step = 'select' | 'count';

export default function InventoryCheckPage() {
  const navigate = useNavigate();
  const auth = useContext(AuthContext);
  const { showToast } = useToast();

  const [step, setStep] = useState<Step>('select');
  const [warehouse, setWarehouse] = useState<WarehouseType>('storage');

  const [loading, setLoading] = useState(false);

  const [rows, setRows] = useState<CheckRow[]>([]);
  const [saving, setSaving] = useState(false);

  // dialogs
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  /* ── 進入盤點時載入資料 ─────────────────────────────── */
  const startCount = async (wh: WarehouseType) => {
    setWarehouse(wh);
    setLoading(true);
    const [{ data: bData }, { data: tData }] = await Promise.all([
      supabase.from('beans').select('*').order('name'),
      supabase.from('inventory_transactions').select('*'),
    ]);
    const allBeans = (bData as Bean[]) ?? [];
    const allTxs = (tData as InventoryTransaction[]) ?? [];

    // Build rows: all batches with stock > 0 in selected warehouse
    const newRows: CheckRow[] = [];
    for (const bean of allBeans) {
      const batches = getBatchesForWarehouse(allTxs, bean.id, wh);
      for (const b of batches) {
        newRows.push({
          beanId: bean.id,
          beanName: bean.name,
          roastDate: b.roastDate,
          systemQty: b.quantity,
          actualQty: '',
        });
      }
    }
    // sort: bean name asc, then roast date asc
    newRows.sort((a, b) => {
      const nc = a.beanName.localeCompare(b.beanName, 'zh');
      if (nc !== 0) return nc;
      return a.roastDate.localeCompare(b.roastDate);
    });

    setRows(newRows);
    setLoading(false);
    setStep('count');
  };

  /* ── 數量更新 ────────────────────────────────────────── */
  const setActual = (idx: number, val: number | '') => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, actualQty: val } : r));
  };

  /* ── 計算差異（actual 未填視為系統庫存，不產生調整） ── */
  const rowsWithDiff = useMemo(() => rows.map(r => ({
    ...r,
    diff: r.actualQty === '' ? 0 : (r.actualQty as number) - r.systemQty,
  })), [rows]);

  const filledCount = rows.filter(r => r.actualQty !== '').length;
  const diffRows = rowsWithDiff.filter(r => r.diff !== 0);
  const warehouseLabel = warehouse === 'storage' ? '二樓倉庫' : '展示櫃';

  /* ── 送出盤點 ────────────────────────────────────────── */
  const handleSubmit = async () => {
    if (!auth?.user) return;
    setSaving(true);
    const today = format(new Date(), 'yyyy-MM-dd');
    let adjustCount = 0;

    // 1. 寫一筆盤點摘要紀錄（不綁定特定批次）
    {
      const { error } = await supabase.from('inventory_transactions').insert({
        transaction_type: 'check',
        transaction_date: today,
        warehouse_from: warehouse,
        warehouse_to: null,
        bean_id: null,
        roast_date: null,
        qty_half_pound: 0,
        qty_150g: 0,
        note: `盤點確認（${warehouseLabel}）`,
        operator_id: auth.user.id,
      });
      if (error) {
        setSaving(false);
        showToast('盤點儲存失敗，請再試一次', 'error');
        return;
      }
    }

    // 2. 有差異的批次，額外寫入調整紀錄
    for (const r of diffRows) {
      const isIn = r.diff > 0;
      const { error } = await supabase.from('inventory_transactions').insert({
        transaction_type: isIn ? 'in' : 'out',
        transaction_date: today,
        warehouse_from: isIn ? null : warehouse,
        warehouse_to: isIn ? warehouse : null,
        bean_id: r.beanId,
        roast_date: r.roastDate,
        qty_half_pound: Math.abs(r.diff),
        qty_150g: 0,
        note: '盤點調整',
        operator_id: auth.user.id,
      });
      if (error) {
        setSaving(false);
        showToast('盤點儲存失敗，請再試一次', 'error');
        return;
      }
      adjustCount++;
    }

    setSaving(false);
    setConfirmOpen(false);
    const msg = adjustCount > 0
      ? `盤點完成，已確認 ${rowsWithDiff.length} 批次，產生 ${adjustCount} 筆調整紀錄`
      : `盤點完成，已確認 ${rowsWithDiff.length} 批次，庫存數量無誤`;
    showToast(msg, 'success');
    setStep('select');
    setRows([]);
  };

  /* ── 取消盤點 ────────────────────────────────────────── */
  const handleCancel = () => {
    setStep('select');
    setRows([]);
    setCancelConfirmOpen(false);
  };

  /* ════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════ */
  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => step === 'count' ? setCancelConfirmOpen(true) : navigate(-1)}
          className="text-cafe-muted hover:text-cafe-dark"
        >
          <ChevronLeft className="h-7 w-7" />
        </button>
        <h1 className="text-xl font-semibold text-cafe-dark">盤點</h1>
        {step === 'count' && (
          <span className="ml-auto text-sm text-cafe-muted">
            已盤點 {filledCount} / {rows.length} 批次
          </span>
        )}
      </div>

      {/* ── 步驟 1：選擇倉庫 ── */}
      {step === 'select' && (
        <div className="flex flex-col gap-4 max-w-sm mx-auto mt-8">
          <p className="text-sm text-cafe-muted text-center mb-2">請選擇要盤點的倉庫</p>
          <button
            onClick={() => startCount('storage')}
            className="flex items-center gap-4 bg-cafe-cream rounded-xl border border-cafe-border px-6 py-5 hover:bg-[#f0ebe2] transition-colors"
          >
            <div className="w-12 h-12 rounded-xl bg-cafe-primary/10 flex items-center justify-center shrink-0">
              <Warehouse className="h-6 w-6 text-cafe-primary" />
            </div>
            <div className="text-left">
              <div className="font-semibold text-cafe-dark">二樓倉庫</div>
              <div className="text-xs text-cafe-muted mt-0.5">盤點二樓倉庫所有批次</div>
            </div>
          </button>
          <button
            onClick={() => startCount('display')}
            className="flex items-center gap-4 bg-cafe-cream rounded-xl border border-cafe-border px-6 py-5 hover:bg-[#f0ebe2] transition-colors"
          >
            <div className="w-12 h-12 rounded-xl bg-cafe-primary/10 flex items-center justify-center shrink-0">
              <ClipboardList className="h-6 w-6 text-cafe-primary" />
            </div>
            <div className="text-left">
              <div className="font-semibold text-cafe-dark">展示櫃</div>
              <div className="text-xs text-cafe-muted mt-0.5">盤點展示櫃所有批次</div>
            </div>
          </button>
        </div>
      )}

      {/* ── 步驟 2：盤點清單 ── */}
      {step === 'count' && (
        <>
          {loading ? (
            <div className="text-center text-cafe-muted py-12 text-sm">載入中...</div>
          ) : rows.length === 0 ? (
            <div className="text-center text-cafe-muted py-12 text-sm">
              {warehouseLabel}目前沒有庫存批次
            </div>
          ) : (
            <>
              {/* 差異摘要 */}
              {filledCount > 0 && (
                <div className="mb-4 rounded-xl border border-cafe-border bg-cafe-cream px-5 py-3 flex flex-wrap gap-4 text-sm">
                  <span className="text-cafe-muted">
                    有差異批次：
                    <span className="font-semibold text-cafe-dark ml-1">{diffRows.length}</span>
                  </span>
                  <span className="text-cafe-muted">
                    總差異：
                    <span className={`font-semibold ml-1 ${
                      diffRows.reduce((s, r) => s + r.diff, 0) > 0 ? 'text-green-600' :
                      diffRows.reduce((s, r) => s + r.diff, 0) < 0 ? 'text-red-500' : 'text-cafe-dark'
                    }`}>
                      {diffRows.reduce((s, r) => s + r.diff, 0) >= 0 ? '+' : ''}
                      {diffRows.reduce((s, r) => s + r.diff, 0)} 包
                    </span>
                  </span>
                </div>
              )}

              {/* 提示 */}
              <div className="mb-3 text-xs text-cafe-muted bg-cafe-bg/40 rounded-lg px-4 py-2">
                ⚠️ 盤點過程中若有其他人同時進行進出庫操作，可能導致差異不準，建議盤點時暫停其他操作。
              </div>

              {/* 批次表格 */}
              <div className="bg-cafe-cream rounded-xl border border-cafe-border overflow-hidden mb-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-cafe-border bg-cafe-bg/30">
                        <th className="px-4 py-3 text-left font-medium text-cafe-muted">豆名</th>
                        <th className="px-4 py-3 text-left font-medium text-cafe-muted whitespace-nowrap">烘豆日期</th>
                        <th className="px-4 py-3 text-left font-medium text-cafe-muted">狀態</th>
                        <th className="px-4 py-3 text-center font-medium text-cafe-muted whitespace-nowrap">系統庫存</th>
                        <th className="px-4 py-3 text-center font-medium text-cafe-muted whitespace-nowrap">實際清點</th>
                        <th className="px-4 py-3 text-center font-medium text-cafe-muted">差異</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-cafe-border/50">
                      {rowsWithDiff.map((r, idx) => (
                        <tr key={`${r.beanId}-${r.roastDate}`} className="hover:bg-cafe-bg/20 transition-colors">
                          <td className="px-4 py-3 font-medium text-cafe-dark">{r.beanName}</td>
                          <td className="px-4 py-3 text-cafe-dark whitespace-nowrap">
                            {r.roastDate.replace(/-/g, '/')}
                          </td>
                          <td className="px-4 py-3">
                            <FreshBadge roastDate={r.roastDate} />
                          </td>
                          <td className="px-4 py-3 text-center text-cafe-dark">{r.systemQty}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => {
                                  const cur = r.actualQty === '' ? r.systemQty : r.actualQty as number;
                                  setActual(idx, Math.max(0, cur - 1));
                                }}
                                className="w-8 h-8 rounded-lg border border-cafe-border bg-cafe-cream flex items-center justify-center hover:bg-cafe-border/40 transition-colors shrink-0"
                              >
                                <Minus className="h-3.5 w-3.5 text-cafe-dark" />
                              </button>
                              <Input
                                type="number"
                                min={0}
                                value={r.actualQty === '' ? '' : r.actualQty}
                                placeholder={String(r.systemQty)}
                                onChange={e => {
                                  const v = e.target.value;
                                  setActual(idx, v === '' ? '' : Math.max(0, Number(v)));
                                }}
                                className="w-16 text-center text-sm px-1"
                              />
                              <button
                                onClick={() => {
                                  const cur = r.actualQty === '' ? r.systemQty : r.actualQty as number;
                                  setActual(idx, cur + 1);
                                }}
                                className="w-8 h-8 rounded-lg border border-cafe-border bg-cafe-cream flex items-center justify-center hover:bg-cafe-border/40 transition-colors shrink-0"
                              >
                                <Plus className="h-3.5 w-3.5 text-cafe-dark" />
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center font-semibold">
                            {r.actualQty === '' ? (
                              <span className="text-cafe-muted/50">—</span>
                            ) : r.diff === 0 ? (
                              <span className="text-cafe-muted">—</span>
                            ) : r.diff > 0 ? (
                              <span className="text-green-600">+{r.diff}</span>
                            ) : (
                              <span className="text-red-500">{r.diff}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bottom actions */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setCancelConfirmOpen(true)}
                >
                  取消盤點
                </Button>
                <Button onClick={() => setConfirmOpen(true)}>
                  送出盤點調整
                </Button>
              </div>
            </>
          )}
        </>
      )}

      {/* ── 送出確認彈窗 ── */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>確認送出盤點</DialogTitle>
          </DialogHeader>
          {diffRows.length === 0 ? (
            <p className="text-sm text-cafe-muted">所有已盤點批次與系統庫存一致，不需要產生調整紀錄。</p>
          ) : (
            <>
              <p className="text-sm text-cafe-muted mb-3">即將為以下批次產生盤點調整紀錄：</p>
              <div className="flex flex-col gap-1.5 max-h-60 overflow-y-auto">
                {diffRows.map(r => (
                  <div key={`${r.beanId}-${r.roastDate}`} className="flex items-center justify-between text-sm bg-cafe-bg/30 rounded-lg px-3 py-2">
                    <span className="text-cafe-dark">
                      {r.beanName}
                      <span className="text-cafe-muted ml-1">（{r.roastDate.replace(/-/g, '/')}）</span>
                    </span>
                    <span className={`font-semibold ml-3 shrink-0 ${r.diff > 0 ? 'text-green-600' : 'text-red-500'}`}>
                      盤點 {r.diff > 0 ? `+${r.diff}` : r.diff} 包
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-sm text-cafe-muted mt-3">確定送出嗎？</p>
            </>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={saving}>取消</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? '儲存中...' : diffRows.length === 0 ? '完成盤點' : '確認送出'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── 取消確認彈窗 ── */}
      <Dialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>確認取消盤點</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-cafe-muted">未送出的資料會遺失，確定要取消嗎？</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelConfirmOpen(false)}>繼續盤點</Button>
            <Button variant="destructive" onClick={handleCancel}>確定取消</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
