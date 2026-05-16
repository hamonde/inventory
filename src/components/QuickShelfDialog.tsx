import { useState, useEffect, useContext, useMemo } from 'react';
import { Minus, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { AuthContext } from '@/lib/authContext';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { getBatchesForWarehouse, calculateBatchInventory } from '@/lib/inventory';
import { format } from 'date-fns';
import type { Bean, InventoryTransaction } from '@/types';

interface QuickShelfDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function QuickShelfDialog({ open, onOpenChange, onSuccess }: QuickShelfDialogProps) {
  const auth = useContext(AuthContext);
  const { showToast } = useToast();

  const [beans, setBeans] = useState<Bean[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selBeanId, setSelBeanId] = useState('');
  const [selRoastDate, setSelRoastDate] = useState('');
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSelBeanId('');
    setSelRoastDate('');
    setQty(1);
    setNote('');
    Promise.all([
      supabase.from('beans').select('*').eq('status', 'selling').is('deleted_at', null),
      supabase.from('inventory_transactions').select('*'),
    ]).then(([{ data: bData }, { data: tData }]) => {
      setBeans((bData as Bean[]) ?? []);
      setTransactions((tData as InventoryTransaction[]) ?? []);
      setLoading(false);
    });
  }, [open]);

  // Beans with stock in storage (二樓倉庫)
  const availableBeans = useMemo(() => {
    return beans.filter(b => {
      const batches = getBatchesForWarehouse(transactions, b.id, 'storage');
      return batches.length > 0;
    });
  }, [beans, transactions]);

  // Batches for selected bean in storage
  const batches = useMemo(() => {
    if (!selBeanId) return [];
    return getBatchesForWarehouse(transactions, selBeanId, 'storage');
  }, [selBeanId, transactions]);

  // Auto-select oldest batch
  useEffect(() => {
    if (batches.length > 0) {
      setSelRoastDate(batches[0].roastDate);
      setQty(1);
    } else {
      setSelRoastDate('');
    }
  }, [batches]);

  const maxQty = useMemo(() => {
    if (!selBeanId || !selRoastDate) return 0;
    return calculateBatchInventory(transactions, selBeanId, 'storage', selRoastDate);
  }, [selBeanId, selRoastDate, transactions]);

  const selectedBean = beans.find(b => b.id === selBeanId);

  const handleConfirm = async () => {
    if (!selBeanId || !selRoastDate || qty < 1 || qty > maxQty) return;
    if (!auth?.user) return;
    setSaving(true);
    const { error } = await supabase.from('inventory_transactions').insert({
      transaction_type: 'shelf',
      transaction_date: format(new Date(), 'yyyy-MM-dd'),
      warehouse_from: 'storage',
      warehouse_to: 'display',
      bean_id: selBeanId,
      roast_date: selRoastDate,
      qty_half_pound: qty,
      qty_150g: 0,
      note: note.trim() || null,
      operator_id: auth.user.id,
    });
    setSaving(false);
    if (error) {
      showToast('上架失敗，請再試一次', 'error');
      return;
    }
    showToast(`✓ 已上架 ${qty} 包 ${selectedBean?.name}`, 'success');
    onOpenChange(false);
    onSuccess?.();
  };

  const noStock = !loading && availableBeans.length === 0;
  const isValid = selBeanId && selRoastDate && qty >= 1 && qty <= maxQty;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>快速上架</DialogTitle>
          <p className="text-sm text-cafe-muted mt-0.5">二樓倉庫 → 展示櫃</p>
        </DialogHeader>

        {loading ? (
          <div className="text-sm text-cafe-muted text-center py-6">載入中...</div>
        ) : noStock ? (
          <div className="rounded-lg bg-cafe-bg/40 px-4 py-6 text-center text-sm text-cafe-muted">
            二樓倉庫目前沒有可上架的豆子
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Bean selector */}
            <div>
              <Label className="mb-2 block">豆名</Label>
              <select
                value={selBeanId}
                onChange={e => setSelBeanId(e.target.value)}
                className="w-full rounded-lg border border-cafe-border bg-cafe-cream px-3 py-2.5 text-sm text-cafe-dark focus:outline-none focus:ring-2 focus:ring-cafe-primary/30"
              >
                <option value="">請選擇咖啡豆</option>
                {availableBeans.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            {/* Batch selector */}
            <div>
              <Label className="mb-2 block">烘豆批次</Label>
              <select
                value={selRoastDate}
                onChange={e => { setSelRoastDate(e.target.value); setQty(1); }}
                disabled={!selBeanId}
                className="w-full rounded-lg border border-cafe-border bg-cafe-cream px-3 py-2.5 text-sm text-cafe-dark focus:outline-none focus:ring-2 focus:ring-cafe-primary/30 disabled:opacity-50"
              >
                <option value="">請選擇批次</option>
                {batches.map(b => (
                  <option key={b.roastDate} value={b.roastDate}>
                    {b.roastDate.replace(/-/g, '/')}（剩 {b.quantity} 包）
                  </option>
                ))}
              </select>
              {selBeanId && batches.length === 0 && (
                <p className="text-xs text-red-500 mt-1">此豆在二樓倉庫無庫存</p>
              )}
            </div>

            {/* Quantity */}
            <div>
              <Label className="mb-2 block">上架數量（半磅包）</Label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQty(q => Math.max(1, q - 1))}
                  disabled={qty <= 1}
                  className="w-11 h-11 rounded-lg border border-cafe-border bg-cafe-cream flex items-center justify-center text-cafe-dark hover:bg-cafe-border/40 disabled:opacity-40 transition-colors"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <Input
                  type="number"
                  min={1}
                  max={maxQty}
                  value={qty}
                  onChange={e => setQty(Math.max(1, Math.min(maxQty || 1, Number(e.target.value))))}
                  className="text-center text-lg font-semibold w-20"
                />
                <button
                  onClick={() => setQty(q => Math.min(maxQty, q + 1))}
                  disabled={qty >= maxQty}
                  className="w-11 h-11 rounded-lg border border-cafe-border bg-cafe-cream flex items-center justify-center text-cafe-dark hover:bg-cafe-border/40 disabled:opacity-40 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                </button>
                {maxQty > 0 && (
                  <span className="text-sm text-cafe-muted">最多 {maxQty} 包</span>
                )}
              </div>
              {qty > maxQty && maxQty > 0 && (
                <p className="text-xs text-red-500 mt-1">數量超過庫存（最多 {maxQty} 包）</p>
              )}
            </div>

            {/* Note */}
            <div>
              <Label className="mb-2 block">備註（選填）</Label>
              <Input
                placeholder="備註..."
                value={note}
                onChange={e => setNote(e.target.value)}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button
            onClick={handleConfirm}
            disabled={!isValid || saving || noStock}
            style={{ background: '#DFCC60', color: '#3D2817' }}
            className="hover:opacity-90"
          >
            {saving ? '處理中...' : '確認上架'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
