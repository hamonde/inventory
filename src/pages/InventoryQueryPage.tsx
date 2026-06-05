import { useState, useEffect } from 'react';
import { differenceInDays, parseISO } from 'date-fns';
import { ChevronLeft, ChevronUp, ChevronDown, FileText } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { getBatchesForWarehouse, getAllActiveBatches } from '@/lib/inventory';
import { formatOrigins } from '@/lib/origin';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { Bean, InventoryTransaction, ProcessCategory, TransactionType } from '@/types';

const PROCESS_LABEL: Record<ProcessCategory, string> = {
  sun_dried: '日曬', washed: '水洗', honey: '蜜處理', special: '特殊處理',
};

const TX_LABEL: Record<TransactionType, string> = {
  in: '進庫', out: '出庫', sell: '售出', shelf: '上架', return: '回倉', check: '盤點',
};

/** 該批次的交易數量顯示文字（含正負號或盤點的 —） */
function batchTxQty(t: InventoryTransaction): string {
  if (t.transaction_type === 'check') return '—';
  const n = t.qty_half_pound;
  if (t.transaction_type === 'in') return `+${n} 包`;
  if (t.transaction_type === 'out' || t.transaction_type === 'sell') return `-${n} 包`;
  return `${n} 包`;
}

type SortKey = 'name' | 'storage' | 'display' | 'total' | 'price_half_pound';
type SortDir = 'asc' | 'desc';
type FreshFilter = 'all' | 'resting' | 'normal' | 'expired' | 'low_stock';

const FRESH_TABS: { key: FreshFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'resting', label: '養豆中' },
  { key: 'normal', label: '正常' },
  { key: 'expired', label: '滿六個月' },
  { key: 'low_stock', label: '低庫存' },
];

interface BatchBadgeProps {
  roastDate: string;
}
function BatchBadge({ roastDate }: BatchBadgeProps) {
  const days = differenceInDays(new Date(), parseISO(roastDate));
  if (days <= 10) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-cafe-accent text-cafe-dark">
        養豆中，還剩 {10 - days} 天
      </span>
    );
  }
  if (days > 180) {
    const overDays = days - 180;
    const months = Math.floor(overDays / 30);
    const remainDays = overDays % 30;
    const overText = months > 0
      ? remainDays > 0 ? `${months} 個月 ${remainDays} 天` : `${months} 個月`
      : `${remainDays} 天`;
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-cafe-primary text-cafe-cream">
        滿六個月 已過 {overText}
      </span>
    );
  }
  return null;
}

/** 依新鮮度篩選，只回傳符合條件的批次 */
function filterBatchesByFreshness(
  batches: { roastDate: string; quantity: number }[],
  filter: FreshFilter
): { roastDate: string; quantity: number }[] {
  if (filter === 'all' || filter === 'low_stock') return batches;
  return batches.filter(b => {
    const days = differenceInDays(new Date(), parseISO(b.roastDate));
    if (filter === 'resting') return days <= 10;
    if (filter === 'expired') return days > 180;
    if (filter === 'normal') return days > 10 && days <= 180;
    return true;
  });
}

/** 計算某倉庫在指定新鮮度篩選下的數量加總 */
function calcFilteredWarehouseTotal(
  txs: InventoryTransaction[],
  beanId: string,
  warehouse: 'storage' | 'display',
  filter: FreshFilter
): number {
  const batches = getBatchesForWarehouse(txs, beanId, warehouse);
  return filterBatchesByFreshness(batches, filter).reduce((s, b) => s + b.quantity, 0);
}

export default function InventoryQueryPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // 從 URL param 讀取初始篩選值（從首頁警示卡片點進來時）
  const urlFilter = searchParams.get('filter') as FreshFilter | null;
  const validFilters: FreshFilter[] = ['all', 'resting', 'normal', 'expired', 'low_stock'];
  const initialFilter: FreshFilter =
    urlFilter && validFilters.includes(urlFilter) ? urlFilter : 'all';

  const [beans, setBeans] = useState<Bean[]>([]);
  const [allTx, setAllTx] = useState<InventoryTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('price_half_pound');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ChevronDown className="h-3.5 w-3.5 text-cafe-muted/40 inline ml-0.5" />;
    return sortDir === 'asc'
      ? <ChevronUp className="h-3.5 w-3.5 text-cafe-primary inline ml-0.5" />
      : <ChevronDown className="h-3.5 w-3.5 text-cafe-primary inline ml-0.5" />;
  };
  const [freshFilter, setFreshFilter] = useState<FreshFilter>(initialFilter);

  const [beanDetailOpen, setBeanDetailOpen] = useState(false);
  const [selectedBean, setSelectedBean] = useState<Bean | null>(null);

  const [batchDetailOpen, setBatchDetailOpen] = useState(false);
  const [batchBean, setBatchBean] = useState<Bean | null>(null);
  const [batchWarehouse, setBatchWarehouse] = useState<'storage' | 'display' | 'total'>('storage');

  // 單一批次的備註彈窗
  const [batchNotesOpen, setBatchNotesOpen] = useState(false);
  const [batchNotesTxs, setBatchNotesTxs] = useState<InventoryTransaction[]>([]);
  const [batchNotesTitle, setBatchNotesTitle] = useState('');

  // 員工名稱對照
  const [profiles, setProfiles] = useState<Record<string, string>>({});

  useEffect(() => {
    Promise.all([
      supabase.from('beans').select('*').is('deleted_at', null).order('name'),
      supabase.from('inventory_transactions').select('*'),
      supabase.from('profiles').select('id, display_name'),
    ]).then(([{ data: b }, { data: t }, { data: p }]) => {
      if (b) setBeans(b as Bean[]);
      if (t) setAllTx(t as InventoryTransaction[]);
      if (p) {
        const m: Record<string, string> = {};
        (p as { id: string; display_name: string | null }[]).forEach(r => {
          if (r.display_name) m[r.id] = r.display_name;
        });
        setProfiles(m);
      }
      setLoading(false);
    });
  }, []);

  /** 撈該批次的相關交易紀錄 */
  const getBatchTxs = (beanId: string, roastDate: string, warehouse: 'storage' | 'display' | 'total') => {
    return allTx
      .filter(t =>
        t.bean_id === beanId &&
        t.roast_date === roastDate &&
        (warehouse === 'total' || t.warehouse_from === warehouse || t.warehouse_to === warehouse)
      )
      .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));
  };

  const openBatchNotes = (bean: Bean, roastDate: string) => {
    const txs = getBatchTxs(bean.id, roastDate, batchWarehouse);
    setBatchNotesTxs(txs);
    setBatchNotesTitle(`${bean.name}（烘豆日 ${roastDate.replace(/-/g, '/')}）`);
    setBatchNotesOpen(true);
  };

  // 計算每個 bean 在目前篩選條件下的數量（非 all 時只加總符合條件的批次）
  const filtered = beans.map(b => ({
    bean: b,
    storage: calcFilteredWarehouseTotal(allTx, b.id, 'storage', freshFilter),
    display: calcFilteredWarehouseTotal(allTx, b.id, 'display', freshFilter),
  })).filter(r => {
    const hasStock = r.storage > 0 || r.display > 0;
    const isSelling = r.bean.status === 'selling';
    if (freshFilter === 'low_stock') {
      // 低庫存：販售中 且 總數 ≤ 2（含 0）
      return isSelling && (r.storage + r.display) <= 2;
    }
    if (freshFilter === 'resting' || freshFilter === 'normal' || freshFilter === 'expired') {
      // 新鮮度相關篩選需要有符合條件的批次
      return hasStock;
    }
    // 全部：販售中豆子一律顯示（含 0 庫存）+ 暫停供應但仍有庫存的
    return isSelling || hasStock;
  });

  const sorted = [...filtered].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    if (sortKey === 'name') return a.bean.name.localeCompare(b.bean.name, 'zh-TW') * dir;
    if (sortKey === 'storage') return (a.storage - b.storage) * dir;
    if (sortKey === 'display') return (a.display - b.display) * dir;
    if (sortKey === 'price_half_pound') return (a.bean.price_half_pound - b.bean.price_half_pound) * dir;
    // total
    return ((a.storage + a.display) - (b.storage + b.display)) * dir;
  });

  const openBatchDetail = (bean: Bean, warehouse: 'storage' | 'display' | 'total') => {
    setBatchBean(bean);
    setBatchWarehouse(warehouse);
    setBatchDetailOpen(true);
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate(-1)} className="text-cafe-muted hover:text-cafe-dark p-1">
          <ChevronLeft className="h-7 w-7" />
        </button>
        <h1 className="text-xl font-semibold text-cafe-dark">查詢豆子庫存</h1>
      </div>

      {/* Freshness filter tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {FRESH_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFreshFilter(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-sm min-h-[36px] transition-colors ${
              freshFilter === tab.key
                ? 'bg-cafe-primary text-cafe-cream'
                : 'bg-cafe-cream text-cafe-muted border border-cafe-border hover:bg-cafe-border/30'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-cafe-muted py-12">載入中...</div>
      ) : sorted.length === 0 ? (
        <div className="text-center text-cafe-muted py-12">
          {freshFilter === 'all' ? '目前無庫存資料' : `沒有「${FRESH_TABS.find(t => t.key === freshFilter)?.label}」的批次`}
        </div>
      ) : (
        <div className="bg-cafe-cream rounded-xl border border-cafe-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cafe-border">
                <th
                  className="text-left px-4 py-3 text-cafe-muted font-medium cursor-pointer hover:text-cafe-dark whitespace-nowrap"
                  onClick={() => toggleSort('name')}
                >
                  豆名<SortIcon k="name" />
                </th>
                <th
                  className="text-center px-4 py-3 text-cafe-muted font-medium whitespace-nowrap cursor-pointer hover:text-cafe-dark"
                  onClick={() => toggleSort('storage')}
                >
                  二樓倉庫<SortIcon k="storage" />
                </th>
                <th
                  className="text-center px-4 py-3 text-cafe-muted font-medium whitespace-nowrap cursor-pointer hover:text-cafe-dark"
                  onClick={() => toggleSort('display')}
                >
                  展示櫃<SortIcon k="display" />
                </th>
                <th
                  className="text-center px-4 py-3 text-cafe-muted font-medium whitespace-nowrap cursor-pointer hover:text-cafe-dark"
                  onClick={() => toggleSort('total')}
                >
                  總數<SortIcon k="total" />
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(({ bean, storage, display }, i) => {
                const total = storage + display;
                const isLow = total <= 2;
                const lowStyle = isLow ? { color: '#E7452A' } : undefined;
                return (
                  <tr key={bean.id} className={`border-b border-cafe-border/50 ${i % 2 === 1 ? 'bg-cafe-bg/10' : ''}`}>
                    <td className="px-4 py-3">
                      <button
                        className="font-medium text-cafe-dark hover:text-cafe-primary hover:underline text-left"
                        onClick={() => { setSelectedBean(bean); setBeanDetailOpen(true); }}
                      >
                        {bean.name}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {storage > 0 ? (
                        <button
                          className={`hover:underline ${isLow ? 'font-bold text-lg' : 'font-medium text-cafe-dark'}`}
                          style={lowStyle}
                          onClick={() => openBatchDetail(bean, 'storage')}
                        >
                          {storage}
                        </button>
                      ) : <span className="text-cafe-muted">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {display > 0 ? (
                        <button
                          className={`hover:underline ${isLow ? 'font-bold text-lg' : 'font-medium text-cafe-dark'}`}
                          style={lowStyle}
                          onClick={() => openBatchDetail(bean, 'display')}
                        >
                          {display}
                        </button>
                      ) : <span className="text-cafe-muted">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {total > 0 ? (
                        <button
                          className={`hover:underline ${isLow ? 'font-bold text-lg' : 'font-semibold text-cafe-dark'}`}
                          style={lowStyle}
                          onClick={() => openBatchDetail(bean, 'total')}
                        >
                          {total}
                        </button>
                      ) : (
                        <span
                          className={`${isLow ? 'font-bold text-lg' : 'font-semibold'}`}
                          style={lowStyle}
                        >
                          {total}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Bean detail dialog */}
      <Dialog open={beanDetailOpen} onOpenChange={setBeanDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedBean?.name}</DialogTitle>
          </DialogHeader>
          {selectedBean && (
            <div className="flex flex-col gap-3 text-sm">
              <div>
                <span className="text-cafe-muted">產地：</span>
                <span className="text-cafe-dark">
                  {formatOrigins(selectedBean.origins)}
                </span>
              </div>
              <div>
                <span className="text-cafe-muted">處理法：</span>
                <span className="text-cafe-dark">
                  {selectedBean.process_detail || PROCESS_LABEL[selectedBean.process_category]}
                </span>
              </div>
              {selectedBean.estate && (
                <div>
                  <span className="text-cafe-muted">莊園：</span>
                  <span className="text-cafe-dark">{selectedBean.estate}</span>
                </div>
              )}
              {selectedBean.processing_plant && (
                <div>
                  <span className="text-cafe-muted">處理廠：</span>
                  <span className="text-cafe-dark">{selectedBean.processing_plant}</span>
                </div>
              )}
              {selectedBean.variety && (
                <div>
                  <span className="text-cafe-muted">品種：</span>
                  <span className="text-cafe-dark">{selectedBean.variety}</span>
                </div>
              )}
              {selectedBean.grade && (
                <div>
                  <span className="text-cafe-muted">等級：</span>
                  <span className="text-cafe-dark">{selectedBean.grade}</span>
                </div>
              )}
              <div>
                <span className="text-cafe-muted">參考風味：</span>
                <span className="text-cafe-dark">{(selectedBean.flavors as string[]).join('、')}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {[
                  ['掛耳', selectedBean.price_drip],
                  ['半磅', selectedBean.price_half_pound],
                  ['蝦皮半磅', selectedBean.price_shopee_half_pound ?? 0],
                  ['手沖', selectedBean.price_pour_over],
                  ['虹吸', selectedBean.price_syphon],
                ].map(([label, price]) => (
                  <div key={label as string} className="bg-cafe-bg/30 rounded-lg px-3 py-2">
                    <div className="text-cafe-muted text-xs">{label as string}</div>
                    <div className="text-cafe-dark font-semibold">NT$ {price}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Batch detail dialog */}
      <Dialog open={batchDetailOpen} onOpenChange={setBatchDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {batchBean?.name} — {
                batchWarehouse === 'storage' ? '二樓倉庫' :
                batchWarehouse === 'display' ? '展示櫃' :
                '全部批次（兩倉合計）'
              }
            </DialogTitle>
          </DialogHeader>
          {batchBean && (
            <div className="flex flex-col gap-3">
              {filterBatchesByFreshness(
                batchWarehouse === 'total'
                  ? getAllActiveBatches(allTx, batchBean.id)
                  : getBatchesForWarehouse(allTx, batchBean.id, batchWarehouse),
                freshFilter
              ).map(b => (
                <div key={b.roastDate} className="flex items-center justify-between bg-cafe-bg/30 rounded-lg px-3 py-2">
                  <div>
                    <div className="text-sm font-medium text-cafe-dark">
                      烘豆日：{b.roastDate.replace(/-/g, '/')}
                    </div>
                    <BatchBadge roastDate={b.roastDate} />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => batchBean && openBatchNotes(batchBean, b.roastDate)}
                      className="p-1.5 rounded-lg text-cafe-muted hover:text-cafe-primary hover:bg-cafe-bg/40 transition-colors"
                      title="查看此批次備註"
                    >
                      <FileText className="h-4 w-4" />
                    </button>
                    <div className="text-lg font-semibold text-cafe-dark">{b.quantity} 包</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 批次備註彈窗 */}
      <Dialog open={batchNotesOpen} onOpenChange={setBatchNotesOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>批次備註 — {batchNotesTitle}</DialogTitle>
          </DialogHeader>
          {(() => {
            const withNotes = batchNotesTxs.filter(t => t.note && t.note.trim());
            if (withNotes.length === 0) {
              return (
                <div className="text-sm text-cafe-muted text-center py-6">
                  此批次沒有備註紀錄
                </div>
              );
            }
            return (
              <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
                {withNotes.map(t => {
                  const opName = profiles[t.operator_id] ?? t.operator_id.slice(0, 8);
                  return (
                    <div key={t.id} className="bg-cafe-bg/20 rounded-lg px-3 py-2 flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-cafe-muted">
                        <span>{t.transaction_date.replace(/-/g, '/')}</span>
                        <span>·</span>
                        <span>{TX_LABEL[t.transaction_type]}</span>
                        <span>{batchTxQty(t)}</span>
                        <span className="ml-auto">{opName}</span>
                      </div>
                      <div className="text-sm text-cafe-dark whitespace-pre-wrap" style={{ lineHeight: 1.6 }}>
                        {t.note}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchNotesOpen(false)}>關閉</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
