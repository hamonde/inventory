import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, Minus, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getBatchesForWarehouse } from '@/lib/inventory';
import type { Bean, InventoryTransaction, PendingTransaction, TransactionType, Warehouse } from '@/types';

const TYPE_LABEL: Record<TransactionType, string> = {
  in: '進庫', out: '出庫', sell: '售出', shelf: '上架', return: '回倉', check: '盤點',
};

const WAREHOUSE_LABEL: Record<Warehouse, string> = {
  storage: '二樓倉庫', display: '展示櫃',
};

function warehouseDisplay(tx: PendingTransaction): string {
  if (tx.transaction_type === 'shelf') return '二樓倉庫 → 展示櫃';
  if (tx.transaction_type === 'return') return '展示櫃 → 二樓倉庫';
  const w = tx.warehouse_to || tx.warehouse_from;
  return w ? WAREHOUSE_LABEL[w] : '—';
}

function getWarehouseForBatch(type: TransactionType, warehouse: Warehouse | null): Warehouse | null {
  if (type === 'shelf') return 'storage';
  if (type === 'return') return 'display';
  if (type === 'out' || type === 'sell') return warehouse;
  return null;
}

export default function InventoryTransactionPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [beans, setBeans] = useState<Bean[]>([]);
  const [allTx, setAllTx] = useState<InventoryTransaction[]>([]);
  const [pending, setPending] = useState<PendingTransaction[]>([]);
  const [saving, setSaving] = useState(false);

  const [txType, setTxType] = useState<TransactionType>('in');
  const [txDate, setTxDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
  const [beanId, setBeanId] = useState('');
  const [qty, setQty] = useState(1);
  const [roastDate, setRoastDate] = useState('');
  const [note, setNote] = useState('');

  const [batches, setBatches] = useState<{ roastDate: string; quantity: number }[]>([]);

  useEffect(() => {
    supabase.from('beans').select('*').eq('status', 'selling').is('deleted_at', null).order('name')
      .then(({ data }) => { if (data) setBeans(data as Bean[]); });
    supabase.from('inventory_transactions').select('*')
      .then(({ data }) => { if (data) setAllTx(data as InventoryTransaction[]); });
  }, []);

  // Recalculate batches when bean/type/warehouse changes
  useEffect(() => {
    if (!beanId) { setBatches([]); setRoastDate(''); return; }
    const wh = getWarehouseForBatch(txType, warehouse);
    if (!wh) { setBatches([]); setRoastDate(''); return; }
    const b = getBatchesForWarehouse(allTx, beanId, wh);
    setBatches(b);
    setRoastDate(b.length > 0 ? b[0].roastDate : '');
  }, [beanId, txType, warehouse, allTx]);

  // Default warehouse for sell
  useEffect(() => {
    if (txType === 'sell' && warehouse === null) setWarehouse('display');
    if (txType === 'shelf' || txType === 'return') setWarehouse(null);
  }, [txType]);

  const pendingDeducted = useCallback((bid: string, rDate: string, wh: Warehouse): number => {
    return pending.reduce((sum, p) => {
      if (p.bean_id !== bid || p.roast_date !== rDate) return sum;
      if (p.warehouse_from === wh) return sum + p.qty_half_pound;
      return sum;
    }, 0);
  }, [pending]);

  const availableQty = useCallback((bid: string, rDate: string, wh: Warehouse): number => {
    const base = getBatchesForWarehouse(allTx, bid, wh).find(b => b.roastDate === rDate)?.quantity ?? 0;
    return base - pendingDeducted(bid, rDate, wh);
  }, [allTx, pendingDeducted]);

  const buildTx = (): PendingTransaction | null => {
    if (!beanId || !txDate || !roastDate) return null;
    if (qty <= 0) return null;

    const base: Omit<PendingTransaction, 'tempId'> = {
      transaction_type: txType,
      transaction_date: txDate,
      warehouse_from: null,
      warehouse_to: null,
      bean_id: beanId,
      roast_date: roastDate,
      qty_half_pound: qty,
      qty_150g: 0,
      note: note || null,
    };

    if (txType === 'in') {
      base.warehouse_to = warehouse;
    } else if (txType === 'out') {
      base.warehouse_from = warehouse;
    } else if (txType === 'sell') {
      base.warehouse_from = warehouse;
    } else if (txType === 'shelf') {
      base.warehouse_from = 'storage';
      base.warehouse_to = 'display';
    } else if (txType === 'return') {
      base.warehouse_from = 'display';
      base.warehouse_to = 'storage';
    }

    return { ...base, tempId: Math.random().toString(36).slice(2) };
  };

  const canAdd = (): boolean => {
    if (!beanId || !txDate || !roastDate || qty <= 0) return false;
    if (txType === 'in') {
      if (!warehouse) return false;
    } else if (txType === 'out' || txType === 'sell') {
      if (!warehouse) return false;
      const avail = availableQty(beanId, roastDate, warehouse);
      if (qty > avail) return false;
    } else if (txType === 'shelf') {
      const avail = availableQty(beanId, roastDate, 'storage');
      if (qty > avail) return false;
    } else if (txType === 'return') {
      const avail = availableQty(beanId, roastDate, 'display');
      if (qty > avail) return false;
    }
    return true;
  };

  const addToPending = () => {
    const tx = buildTx();
    if (!tx) return;
    setPending(prev => [...prev, tx]);
    setQty(1);
    setNote('');
    setRoastDate('');
  };

  const saveAll = async () => {
    if (!user || pending.length === 0) return;
    setSaving(true);
    try {
      const rows = pending.map(p => {
        const { tempId: _, ...rest } = p;
        return { ...rest, operator_id: user.id };
      });
      const { error } = await supabase.from('inventory_transactions').insert(rows);
      if (error) throw error;
      const { data } = await supabase.from('inventory_transactions').select('*');
      if (data) setAllTx(data as InventoryTransaction[]);
      showToast(`已儲存 ${pending.length} 筆交易`, 'success');
      setPending([]);
    } catch {
      showToast('儲存失敗，請再試一次', 'error');
    } finally {
      setSaving(false);
    }
  };

  const batchLabel = (b: { roastDate: string; quantity: number }) => {
    const wh = getWarehouseForBatch(txType, warehouse);
    const deducted = wh ? pendingDeducted(beanId, b.roastDate, wh) : 0;
    const available = b.quantity - deducted;
    return `${b.roastDate.replace(/-/g, '/')}（剩 ${available} 包）`;
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-cafe-muted hover:text-cafe-dark">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-semibold text-cafe-dark">進出豆子庫存</h1>
      </div>

      {/* Pending table */}
      {pending.length > 0 && (
        <div className="bg-cafe-cream rounded-xl border border-cafe-border p-4 mb-6">
          <div className="font-medium text-cafe-dark mb-3">暫存清單（{pending.length} 筆）</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cafe-border">
                  {['類型', '日期', '倉庫', '豆名', '數量（包）', '烘豆日期', '備註', ''].map(h => (
                    <th key={h} className="text-left px-3 py-2 text-cafe-muted font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pending.map(p => {
                  const bean = beans.find(b => b.id === p.bean_id);
                  return (
                    <tr key={p.tempId} className="border-b border-cafe-border/40">
                      <td className="px-3 py-2 font-medium">{TYPE_LABEL[p.transaction_type]}</td>
                      <td className="px-3 py-2 text-cafe-muted whitespace-nowrap">{p.transaction_date}</td>
                      <td className="px-3 py-2 text-cafe-muted whitespace-nowrap">{warehouseDisplay(p)}</td>
                      <td className="px-3 py-2">{bean?.name ?? p.bean_id}</td>
                      <td className="px-3 py-2 text-right">{p.qty_half_pound}</td>
                      <td className="px-3 py-2 text-cafe-muted whitespace-nowrap">{p.roast_date}</td>
                      <td className="px-3 py-2 text-cafe-muted">{p.note ?? '—'}</td>
                      <td className="px-3 py-2">
                        <button onClick={() => setPending(prev => prev.filter(x => x.tempId !== p.tempId))} className="text-cafe-muted hover:text-red-500">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex gap-3 mt-4">
            <Button onClick={saveAll} disabled={saving}>
              {saving ? '儲存中...' : `儲存到資料庫（${pending.length} 筆）`}
            </Button>
            <Button variant="outline" onClick={() => setPending([])}>清空暫存</Button>
          </div>
        </div>
      )}

      {/* Form */}
      <div className="bg-cafe-cream rounded-xl border border-cafe-border p-6 flex flex-col gap-5">

        {/* Transaction type */}
        <div>
          <Label className="mb-2 block">類型 <span className="text-red-500">*</span></Label>
          <div className="flex flex-wrap gap-2">
            {(['in', 'out', 'sell', 'shelf', 'return'] as TransactionType[]).map(t => (
              <button
                key={t}
                onClick={() => { setTxType(t); setWarehouse(t === 'sell' ? 'display' : null); setRoastDate(''); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium min-h-[44px] transition-colors ${txType === t ? 'bg-cafe-primary text-cafe-cream' : 'bg-cafe-bg/40 text-cafe-dark hover:bg-cafe-border'}`}
              >
                {TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Date */}
          <div>
            <Label className="mb-2 block">日期 <span className="text-red-500">*</span></Label>
            <Input type="date" value={txDate} onChange={e => setTxDate(e.target.value)} />
          </div>

          {/* Warehouse */}
          {txType !== 'shelf' && txType !== 'return' && (
            <div>
              <Label className="mb-2 block">
                倉庫{(txType === 'in' || txType === 'out') && <span className="text-red-500"> *</span>}
              </Label>
              <div className="flex gap-2">
                {(['storage', 'display'] as Warehouse[]).map(w => (
                  <button
                    key={w}
                    onClick={() => setWarehouse(w)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium min-h-[44px] transition-colors ${warehouse === w ? 'bg-cafe-primary text-cafe-cream' : 'bg-cafe-bg/40 text-cafe-dark hover:bg-cafe-border'}`}
                  >
                    {WAREHOUSE_LABEL[w]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bean */}
        <div>
          <Label className="mb-2 block">豆名 <span className="text-red-500">*</span></Label>
          <Select value={beanId} onValueChange={v => { setBeanId(v); setRoastDate(''); }}>
            <SelectTrigger><SelectValue placeholder="選擇咖啡豆" /></SelectTrigger>
            <SelectContent>
              {beans.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Roast date */}
        <div>
          <Label className="mb-2 block">烘豆日期 <span className="text-red-500">*</span></Label>
          {txType === 'in' ? (
            <Input type="date" value={roastDate} onChange={e => setRoastDate(e.target.value)} />
          ) : (
            <Select value={roastDate} onValueChange={setRoastDate} disabled={!beanId}>
              <SelectTrigger>
                <SelectValue placeholder={batches.length === 0 ? '（無可用批次）' : '選擇烘豆日期'} />
              </SelectTrigger>
              <SelectContent>
                {batches.map(b => (
                  <SelectItem key={b.roastDate} value={b.roastDate}>{batchLabel(b)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Qty */}
        <div>
          <Label className="mb-2 block">半磅數量 <span className="text-red-500">*</span></Label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setQty(v => Math.max(1, v - 1))}
              className="w-11 h-11 rounded-lg border border-cafe-border bg-cafe-cream flex items-center justify-center text-cafe-dark hover:bg-cafe-border/50"
            >
              <Minus className="h-4 w-4" />
            </button>
            <Input
              type="number"
              min={1}
              value={qty}
              onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-24 text-center"
            />
            <button
              onClick={() => setQty(v => v + 1)}
              className="w-11 h-11 rounded-lg border border-cafe-border bg-cafe-cream flex items-center justify-center text-cafe-dark hover:bg-cafe-border/50"
            >
              <Plus className="h-4 w-4" />
            </button>
            <span className="text-cafe-muted text-sm">包</span>
          </div>
          {/* Availability warning */}
          {beanId && roastDate && txType !== 'in' && (() => {
            const wh = getWarehouseForBatch(txType, warehouse);
            if (!wh) return null;
            const avail = availableQty(beanId, roastDate, wh);
            if (qty > avail) return (
              <p className="text-sm text-red-500 mt-1">數量超過庫存（目前剩 {avail} 包）</p>
            );
            return null;
          })()}
        </div>

        {/* Note */}
        <div>
          <Label className="mb-2 block">備註</Label>
          <Input placeholder="備註（選填）" value={note} onChange={e => setNote(e.target.value)} />
        </div>

        <div className="pt-2">
          <Button onClick={addToPending} disabled={!canAdd()}>
            <Plus className="h-4 w-4 mr-1" />加入暫存表格
          </Button>
        </div>
      </div>
    </div>
  );
}
