import { useState, useEffect, useMemo } from 'react';
import { ChevronUp, ChevronDown, Trash2, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import type { Bean } from '@/types';

export interface DripItem {
  id: string;
  bean_id: string | null;
  display_name: string;
  price: number;
  sort_order: number;
}

interface DripBagSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 對話框關閉時呼叫，讓母頁重抓資料 */
  onClosed: () => void;
}

export default function DripBagSettingsDialog({ open, onOpenChange, onClosed }: DripBagSettingsDialogProps) {
  const [items, setItems] = useState<DripItem[]>([]);
  const [beans, setBeans] = useState<Bean[]>([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [selectedAddBeanId, setSelectedAddBeanId] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      supabase.from('drip_bag_items').select('*').order('sort_order'),
      // 全部豆子（不限販售狀態，僅排除軟刪除）
      supabase.from('beans').select('*').is('deleted_at', null).order('name'),
    ]).then(([{ data: i }, { data: b }]) => {
      setItems((i as DripItem[]) ?? []);
      setBeans((b as Bean[]) ?? []);
      setLoading(false);
    });
  }, [open]);

  /* 已被加入掛耳清單的 bean_id 不再列入下拉選單 */
  const availableBeans = useMemo(() => {
    const used = new Set(items.map(it => it.bean_id).filter(Boolean));
    let list = beans.filter(b => !used.has(b.id));
    const q = search.trim();
    if (q) list = list.filter(b => b.name.toLowerCase().includes(q.toLowerCase()));
    return list;
  }, [beans, items, search]);

  /* ── 操作 ── */
  const updateLocal = (id: string, patch: Partial<DripItem>) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it));
  };

  const saveField = async (id: string, field: 'display_name' | 'price', value: string | number) => {
    await supabase.from('drip_bag_items').update({ [field]: value }).eq('id', id);
  };

  const deleteItem = async (id: string) => {
    setItems(prev => prev.filter(it => it.id !== id));
    await supabase.from('drip_bag_items').delete().eq('id', id);
  };

  const moveItem = async (id: string, direction: 'up' | 'down') => {
    const idx = items.findIndex(it => it.id === id);
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= items.length) return;
    const newArr = [...items];
    [newArr[idx], newArr[targetIdx]] = [newArr[targetIdx], newArr[idx]];
    const reindexed = newArr.map((it, i) => ({ ...it, sort_order: i + 1 }));
    setItems(reindexed);
    // 只更新兩筆即可，但為了維持順序乾淨，把所有 sort_order 重寫
    await Promise.all(reindexed.map(it =>
      supabase.from('drip_bag_items').update({ sort_order: it.sort_order }).eq('id', it.id)
    ));
  };

  const addItem = async () => {
    if (!selectedAddBeanId) return;
    const bean = beans.find(b => b.id === selectedAddBeanId);
    if (!bean) return;
    const nextOrder = items.length > 0 ? Math.max(...items.map(it => it.sort_order)) + 1 : 1;
    const { data, error } = await supabase
      .from('drip_bag_items')
      .insert({
        bean_id: bean.id,
        display_name: bean.name,
        price: 48,
        sort_order: nextOrder,
      })
      .select()
      .single();
    if (!error && data) {
      setItems(prev => [...prev, data as DripItem]);
    }
    setSelectedAddBeanId('');
    setSearch('');
    setAddOpen(false);
  };

  const handleOpenChange = (val: boolean) => {
    if (!val) {
      setAddOpen(false);
      setSelectedAddBeanId('');
      setSearch('');
      onClosed();
    }
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-cafe-border shrink-0">
          <DialogTitle>編輯掛耳清單</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="text-center text-cafe-muted py-8">載入中...</div>
          ) : (
            <div className="flex flex-col gap-2">
              {items.length === 0 && (
                <div className="text-center text-cafe-muted py-4 text-sm">尚未加入任何掛耳品項</div>
              )}
              {items.map((it, idx) => (
                <div key={it.id} className="flex items-center gap-2 bg-cafe-bg/30 rounded-lg px-2 py-2">
                  <div className="flex flex-col">
                    <button
                      onClick={() => moveItem(it.id, 'up')}
                      disabled={idx === 0}
                      className="p-0.5 text-cafe-muted hover:text-cafe-dark disabled:opacity-30"
                      title="上移"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => moveItem(it.id, 'down')}
                      disabled={idx === items.length - 1}
                      className="p-0.5 text-cafe-muted hover:text-cafe-dark disabled:opacity-30"
                      title="下移"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>
                  <Input
                    value={it.display_name}
                    onChange={e => updateLocal(it.id, { display_name: e.target.value })}
                    onBlur={() => saveField(it.id, 'display_name', it.display_name)}
                    className="flex-1"
                    placeholder="顯示名稱"
                  />
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-cafe-muted">$</span>
                    <Input
                      type="number"
                      min={0}
                      value={String(it.price)}
                      onChange={e => updateLocal(it.id, { price: Number(e.target.value) || 0 })}
                      onBlur={() => saveField(it.id, 'price', it.price)}
                      className="w-20 text-center"
                    />
                  </div>
                  <button
                    onClick={() => deleteItem(it.id)}
                    className="p-1.5 text-cafe-muted hover:text-red-500 rounded-lg"
                    title="刪除"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}

              {/* 新增 */}
              {addOpen ? (
                <div className="flex flex-col gap-2 mt-3 p-3 rounded-lg border border-cafe-border bg-cafe-bg/20">
                  <Input
                    placeholder="搜尋豆名…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                  <select
                    value={selectedAddBeanId}
                    onChange={e => setSelectedAddBeanId(e.target.value)}
                    className="w-full rounded-lg border border-cafe-border bg-cafe-cream px-3 py-2.5 text-sm text-cafe-dark focus:outline-none focus:ring-2 focus:ring-cafe-primary/30"
                  >
                    <option value="">請選擇豆子</option>
                    {availableBeans.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name}{b.status === 'sold_out' ? '（暫停供應）' : ''}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2 justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setAddOpen(false); setSelectedAddBeanId(''); setSearch(''); }}
                    >
                      取消
                    </Button>
                    <Button size="sm" onClick={addItem} disabled={!selectedAddBeanId}>
                      新增
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  className="text-sm text-cafe-primary hover:underline text-left mt-2"
                  onClick={() => setAddOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5 inline mr-1" />新增掛耳品項
                </button>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-cafe-border shrink-0">
          <Button onClick={() => handleOpenChange(false)}>完成</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
