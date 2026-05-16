import { useState, useEffect, useCallback } from 'react';
import { ChevronRight, ChevronDown, Plus, X, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { FLAVOR_CATEGORIES } from '@/lib/flavors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

interface FlavorPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedFlavors: string[];
  onChange: (flavors: string[]) => void;
}

export default function FlavorPickerDialog({
  open, onOpenChange, selectedFlavors, onChange,
}: FlavorPickerDialogProps) {
  // 展開狀態：Set of category/subcategory ids
  const [expandedCats, setExpandedCats]  = useState<Set<string>>(new Set());
  const [expandedSubs, setExpandedSubs]  = useState<Set<string>>(new Set());

  // 自訂風味
  const [customFlavors, setCustomFlavors] = useState<string[]>([]);
  const [newFlavorInput, setNewFlavorInput] = useState('');
  const [expandedCustom, setExpandedCustom] = useState(false);

  // 刪除確認
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const loadCustomFlavors = useCallback(() => {
    supabase.from('custom_flavors').select('name').order('name').then(({ data }) => {
      if (data) setCustomFlavors(data.map((r: { name: string }) => r.name));
    });
  }, []);

  useEffect(() => {
    if (open) loadCustomFlavors();
  }, [open, loadCustomFlavors]);

  const toggle = (flavor: string) => {
    onChange(
      selectedFlavors.includes(flavor)
        ? selectedFlavors.filter(f => f !== flavor)
        : [...selectedFlavors, flavor]
    );
  };

  const toggleCat = (id: string) => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSub = (id: string) => {
    setExpandedSubs(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const addCustomFlavor = async () => {
    const name = newFlavorInput.trim();
    if (!name) return;
    await supabase.from('custom_flavors').upsert({ name }, { onConflict: 'name', ignoreDuplicates: true });
    loadCustomFlavors();
    if (!selectedFlavors.includes(name)) onChange([...selectedFlavors, name]);
    setNewFlavorInput('');
  };

  const deleteCustomFlavor = async (name: string) => {
    await supabase.from('custom_flavors').delete().eq('name', name);
    setCustomFlavors(prev => prev.filter(f => f !== name));
    setDeleteTarget(null);
  };

  // 計算某分類已選數
  const catSelectedCount = (catId: string) => {
    const cat = FLAVOR_CATEGORIES.find(c => c.id === catId);
    if (!cat) return 0;
    return cat.subcategories.flatMap(s => s.flavors).filter(f => selectedFlavors.includes(f)).length;
  };

  const subSelectedCount = (flavors: string[]) =>
    flavors.filter(f => selectedFlavors.includes(f)).length;

  const customSelected = customFlavors.filter(f => selectedFlavors.includes(f)).length;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-cafe-border shrink-0">
            <DialogTitle>選擇參考風味</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
            {/* 已選風味區 */}
            <div className="rounded-lg bg-cafe-bg/40 px-4 py-3">
              <div className="text-xs font-medium text-cafe-muted mb-2">
                已選風味（{selectedFlavors.length}）
              </div>
              {selectedFlavors.length === 0 ? (
                <div className="text-xs text-cafe-muted">尚未選擇風味</div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {selectedFlavors.map(f => (
                    <span
                      key={f}
                      className="inline-flex items-center gap-1 bg-cafe-primary text-cafe-cream text-xs rounded-full px-2.5 py-0.5"
                    >
                      {f}
                      <button onClick={() => toggle(f)} className="hover:opacity-70">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* 階層列表 */}
            <div className="rounded-lg border border-cafe-border bg-cafe-cream divide-y divide-cafe-border/50">
              {FLAVOR_CATEGORIES.map(cat => {
                const catExpanded = expandedCats.has(cat.id);
                const selCount = catSelectedCount(cat.id);
                return (
                  <div key={cat.id}>
                    {/* 大類列 */}
                    <button
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-cafe-bg/20 text-left transition-colors"
                      onClick={() => toggleCat(cat.id)}
                    >
                      {catExpanded
                        ? <ChevronDown className="h-4 w-4 text-cafe-muted shrink-0" />
                        : <ChevronRight className="h-4 w-4 text-cafe-muted shrink-0" />}
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ background: cat.color }}
                      />
                      <span className="flex-1 text-sm font-medium text-cafe-dark">{cat.name}</span>
                      {selCount > 0 && (
                        <span className="text-xs text-cafe-primary font-medium shrink-0">
                          已選 {selCount}
                        </span>
                      )}
                    </button>

                    {/* 子類 */}
                    {catExpanded && (
                      <div className="bg-cafe-bg/10">
                        {cat.subcategories.map(sub => {
                          const subExpanded = expandedSubs.has(sub.id);
                          const subSel = subSelectedCount(sub.flavors);
                          return (
                            <div key={sub.id}>
                              <button
                                className="w-full flex items-center gap-3 pl-10 pr-4 py-2.5 hover:bg-cafe-bg/30 text-left transition-colors"
                                onClick={() => toggleSub(sub.id)}
                              >
                                {subExpanded
                                  ? <ChevronDown className="h-3.5 w-3.5 text-cafe-muted shrink-0" />
                                  : <ChevronRight className="h-3.5 w-3.5 text-cafe-muted shrink-0" />}
                                <span className="flex-1 text-sm text-cafe-dark">{sub.name}</span>
                                {subSel > 0 && (
                                  <span className="text-xs text-cafe-primary shrink-0">已選 {subSel}</span>
                                )}
                              </button>

                              {subExpanded && (
                                <div className="pl-16 pr-4 pb-3 flex flex-wrap gap-1.5">
                                  {sub.flavors.map(f => {
                                    const selected = selectedFlavors.includes(f);
                                    return (
                                      <button
                                        key={f}
                                        onClick={() => toggle(f)}
                                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition-colors ${
                                          selected
                                            ? 'bg-cafe-primary text-cafe-cream'
                                            : 'bg-cafe-cream text-cafe-dark border border-cafe-border hover:bg-cafe-border/40'
                                        }`}
                                      >
                                        {selected && <span>✓</span>}
                                        {f}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* 自訂風味分類 */}
              <div style={{ background: '#FDFAF0' }}>
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F5F0DC] text-left transition-colors"
                  onClick={() => setExpandedCustom(v => !v)}
                >
                  {expandedCustom
                    ? <ChevronDown className="h-4 w-4 text-cafe-muted shrink-0" />
                    : <ChevronRight className="h-4 w-4 text-cafe-muted shrink-0" />}
                  <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-cafe-accent" />
                  <span className="flex-1 text-sm font-medium text-cafe-dark">自訂風味</span>
                  {customSelected > 0 && (
                    <span className="text-xs text-cafe-primary font-medium shrink-0">已選 {customSelected}</span>
                  )}
                </button>

                {expandedCustom && (
                  <div className="pl-10 pr-4 pb-4">
                    {customFlavors.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {customFlavors.map(f => {
                          const selected = selectedFlavors.includes(f);
                          return (
                            <span key={f} className="inline-flex items-center gap-1">
                              <button
                                onClick={() => toggle(f)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition-colors ${
                                  selected
                                    ? 'bg-cafe-primary text-cafe-cream'
                                    : 'bg-cafe-cream text-cafe-dark border border-cafe-border hover:bg-cafe-border/40'
                                }`}
                              >
                                {selected && <span>✓</span>}
                                {f}
                              </button>
                              <button
                                onClick={() => setDeleteTarget(f)}
                                className="p-1 text-cafe-muted hover:text-red-500 transition-colors"
                                title="刪除"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                    {customFlavors.length === 0 && (
                      <div className="text-xs text-cafe-muted mb-3">尚無自訂風味</div>
                    )}
                    <div className="flex gap-2">
                      <Input
                        placeholder="新增自訂風味…"
                        value={newFlavorInput}
                        onChange={e => setNewFlavorInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addCustomFlavor()}
                        className="h-9 text-sm"
                      />
                      <Button size="sm" onClick={addCustomFlavor} disabled={!newFlavorInput.trim()}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t border-cafe-border shrink-0">
            <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
            <Button onClick={() => onOpenChange(false)}>確定</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 刪除自訂風味二次確認 */}
      <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>確認刪除自訂風味</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-cafe-muted">
            確定刪除「{deleteTarget}」這個自訂風味嗎？已使用此風味的豆子不會被影響。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>取消</Button>
            <Button variant="destructive" onClick={() => deleteTarget && deleteCustomFlavor(deleteTarget)}>
              確認刪除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
