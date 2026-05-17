import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Pencil, Trash2, ChevronLeft, Download } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import type { Bean, ProcessCategory, BeanStatus } from '@/types';

const PROCESS_LABEL: Record<ProcessCategory, string> = {
  sun_dried: '日曬',
  washed: '水洗',
  honey: '蜜處理',
  special: '特殊處理',
};

const STATUS_LABEL: Record<BeanStatus, string> = {
  selling: '販售中',
  sold_out: '售完',
};

const OPTIONAL_COLS = [
  { key: 'origins', label: '產地' },
  { key: 'process', label: '處理法' },
  { key: 'processing_plant', label: '處理廠' },
  { key: 'flavors', label: '參考風味' },
  { key: 'price_drip', label: '掛耳' },
  { key: 'price_half_pound', label: '半磅' },
  { key: 'price_pour_over', label: '手沖' },
  { key: 'price_syphon', label: '虹吸' },
] as const;

type OptColKey = typeof OPTIONAL_COLS[number]['key'];
const ALL_COL_KEYS: OptColKey[] = OPTIONAL_COLS.map(c => c.key);

export default function BeansQueryPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [beans, setBeans] = useState<Bean[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | BeanStatus>('all');
  const [processFilter, setProcessFilter] = useState<'all' | ProcessCategory>('all');
  const [visibleCols, setVisibleCols] = useState<Set<OptColKey>>(new Set(['origins', 'process']));
  const [deleteTarget, setDeleteTarget] = useState<Bean | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('beans')
      .select('*')
      .is('deleted_at', null)
      .order('name');
    if (data) setBeans(data as Bean[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = beans.filter(b => {
    if (statusFilter !== 'all' && b.status !== statusFilter) return false;
    if (processFilter !== 'all' && b.process_category !== processFilter) return false;
    if (search && !b.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const toggleCol = (k: OptColKey) => {
    setVisibleCols(prev => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  };

  const isAllCols = ALL_COL_KEYS.every(k => visibleCols.has(k));
  const toggleAllCols = () => {
    setVisibleCols(isAllCols ? new Set() : new Set(ALL_COL_KEYS));
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { count } = await supabase
      .from('inventory_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('bean_id', deleteTarget.id);

    if (count && count > 0) {
      await supabase.from('beans').update({ deleted_at: new Date().toISOString() }).eq('id', deleteTarget.id);
    } else {
      await supabase.from('beans').delete().eq('id', deleteTarget.id);
    }
    showToast(`已刪除「${deleteTarget.name}」`, 'success');
    setDeleteTarget(null);
    setDeleting(false);
    load();
  };

  // CSV 匯出（依目前篩選結果 + 顯示中的欄位）
  const exportCSV = () => {
    if (filtered.length === 0) {
      showToast('沒有可匯出的資料', 'error');
      return;
    }
    const header = ['名稱', '狀態'];
    if (visibleCols.has('origins')) header.push('產地');
    if (visibleCols.has('process')) header.push('處理法');
    if (visibleCols.has('processing_plant')) header.push('處理廠');
    if (visibleCols.has('flavors')) header.push('參考風味');
    if (visibleCols.has('price_drip')) header.push('掛耳價');
    if (visibleCols.has('price_half_pound')) header.push('半磅價');
    if (visibleCols.has('price_pour_over')) header.push('手沖價');
    if (visibleCols.has('price_syphon')) header.push('虹吸價');

    const rows = filtered.map(b => {
      const row: (string | number)[] = [b.name, STATUS_LABEL[b.status]];
      if (visibleCols.has('origins')) row.push(b.origins.map(o => `${o.country}${o.region ? ' ' + o.region : ''}`).join('、'));
      if (visibleCols.has('process')) row.push(b.process_detail || PROCESS_LABEL[b.process_category]);
      if (visibleCols.has('processing_plant')) row.push(b.processing_plant || '');
      if (visibleCols.has('flavors')) row.push((b.flavors as string[]).join('、'));
      if (visibleCols.has('price_drip')) row.push(b.price_drip);
      if (visibleCols.has('price_half_pound')) row.push(b.price_half_pound);
      if (visibleCols.has('price_pour_over')) row.push(b.price_pour_over);
      if (visibleCols.has('price_syphon')) row.push(b.price_syphon);
      return row;
    });

    const csv = [header, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const bom = '﻿';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `HAMONDE_豆子品項_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate(-1)} className="text-cafe-muted hover:text-cafe-dark p-1">
          <ChevronLeft className="h-7 w-7" />
        </button>
        <h1 className="text-xl font-semibold text-cafe-dark">查詢豆子品項</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5">
            <Download className="h-4 w-4" />
            匯出 CSV
          </Button>
          <Button size="sm" onClick={() => navigate('/beans/new')}>+ 新增</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-cafe-cream rounded-xl border border-cafe-border p-4 mb-4 flex flex-col gap-4">
        {/* 銷售狀態篩選 */}
        <div>
          <div className="text-xs text-cafe-muted mb-1.5">銷售狀態</div>
          <div className="flex gap-1.5 flex-wrap">
            {([['all', '全部'], ['selling', '販售中'], ['sold_out', '售完']] as [string, string][]).map(([v, l]) => (
              <button
                key={v}
                onClick={() => setStatusFilter(v as 'all' | BeanStatus)}
                className={`px-3 py-1.5 rounded-lg text-sm min-h-[36px] transition-colors ${statusFilter === v ? 'bg-cafe-primary text-cafe-cream' : 'bg-cafe-bg/50 text-cafe-dark hover:bg-cafe-border'}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* 處理法篩選 */}
        <div>
          <div className="text-xs text-cafe-muted mb-1.5">處理法</div>
          <div className="flex gap-1.5 flex-wrap">
            {([['all', '全部'], ['sun_dried', '日曬'], ['washed', '水洗'], ['honey', '蜜處理'], ['special', '特殊處理']] as [string, string][]).map(([v, l]) => (
              <button
                key={v}
                onClick={() => setProcessFilter(v as 'all' | ProcessCategory)}
                className={`px-3 py-1.5 rounded-lg text-sm min-h-[36px] transition-colors ${processFilter === v ? 'bg-cafe-primary text-cafe-cream' : 'bg-cafe-bg/50 text-cafe-dark hover:bg-cafe-border'}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* 顯示欄位 */}
        <div>
          <div className="text-xs text-cafe-muted mb-1.5">顯示欄位（可多選）</div>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={toggleAllCols}
              className={`px-3 py-1.5 rounded-lg text-sm min-h-[36px] transition-colors border ${isAllCols ? 'bg-cafe-primary border-cafe-primary text-cafe-cream' : 'border-cafe-border text-cafe-muted hover:bg-cafe-border/30'}`}
            >
              全部
            </button>
            {OPTIONAL_COLS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => toggleCol(key)}
                className={`px-3 py-1.5 rounded-lg text-sm min-h-[36px] transition-colors border ${visibleCols.has(key) ? 'border-cafe-primary text-cafe-primary' : 'border-cafe-border text-cafe-muted hover:bg-cafe-border/30'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 搜尋 */}
        <div>
          <div className="text-xs text-cafe-muted mb-1.5">搜尋豆名</div>
          <div className="flex items-center gap-2">
            <button onClick={() => setSearchOpen(v => !v)} className="p-2 text-cafe-muted hover:text-cafe-dark border border-cafe-border rounded-lg">
              <Search className="h-5 w-5" />
            </button>
            {searchOpen && (
              <div className="relative flex-1 max-w-xs">
                <Input
                  placeholder="輸入豆名關鍵字"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  autoFocus
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-cafe-muted">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center text-cafe-muted py-12">載入中...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-cafe-muted py-12">沒有符合條件的豆子</div>
      ) : (
        <div className="bg-cafe-cream rounded-xl border border-cafe-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cafe-border">
                <th className="text-left px-4 py-3 text-cafe-muted font-medium">名稱</th>
                <th className="text-left px-4 py-3 text-cafe-muted font-medium">狀態</th>
                {visibleCols.has('origins') && <th className="text-left px-4 py-3 text-cafe-muted font-medium">產地</th>}
                {visibleCols.has('process') && <th className="text-left px-4 py-3 text-cafe-muted font-medium">處理法</th>}
                {visibleCols.has('processing_plant') && <th className="text-left px-4 py-3 text-cafe-muted font-medium">處理廠</th>}
                {visibleCols.has('flavors') && <th className="text-left px-4 py-3 text-cafe-muted font-medium">風味</th>}
                {visibleCols.has('price_drip') && <th className="text-right px-4 py-3 text-cafe-muted font-medium whitespace-nowrap">掛耳</th>}
                {visibleCols.has('price_half_pound') && <th className="text-right px-4 py-3 text-cafe-muted font-medium whitespace-nowrap">半磅</th>}
                {visibleCols.has('price_pour_over') && <th className="text-right px-4 py-3 text-cafe-muted font-medium whitespace-nowrap">手沖</th>}
                {visibleCols.has('price_syphon') && <th className="text-right px-4 py-3 text-cafe-muted font-medium whitespace-nowrap">虹吸</th>}
                <th className="text-center px-4 py-3 text-cafe-muted font-medium whitespace-nowrap">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((bean, i) => (
                <tr key={bean.id} className={`border-b border-cafe-border/50 ${i % 2 === 1 ? 'bg-cafe-bg/10' : ''}`}>
                  <td className="px-4 py-3 font-medium text-cafe-dark">{bean.name}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${bean.status === 'selling' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {STATUS_LABEL[bean.status]}
                    </span>
                  </td>
                  {visibleCols.has('origins') && (
                    <td className="px-4 py-3 text-cafe-muted">
                      {bean.origins.map(o => `${o.country}${o.region ? ' ' + o.region : ''}`).join('、')}
                    </td>
                  )}
                  {visibleCols.has('process') && (
                    <td className="px-4 py-3 text-cafe-muted">
                      {bean.process_detail || PROCESS_LABEL[bean.process_category]}
                    </td>
                  )}
                  {visibleCols.has('processing_plant') && (
                    <td className="px-4 py-3 text-cafe-muted">{bean.processing_plant || '—'}</td>
                  )}
                  {visibleCols.has('flavors') && (
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(bean.flavors as string[]).map(f => (
                          <span
                            key={f}
                            className="inline-block px-2 py-0.5 rounded-md border border-cafe-border bg-cafe-cream text-cafe-dark text-xs"
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                    </td>
                  )}
                  {visibleCols.has('price_drip') && <td className="px-4 py-3 text-right text-cafe-dark">{bean.price_drip}</td>}
                  {visibleCols.has('price_half_pound') && <td className="px-4 py-3 text-right text-cafe-dark">{bean.price_half_pound}</td>}
                  {visibleCols.has('price_pour_over') && <td className="px-4 py-3 text-right text-cafe-dark">{bean.price_pour_over}</td>}
                  {visibleCols.has('price_syphon') && <td className="px-4 py-3 text-right text-cafe-dark">{bean.price_syphon}</td>}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => navigate(`/beans/${bean.id}/edit`)}
                        className="p-1.5 text-cafe-muted hover:text-cafe-primary rounded-lg hover:bg-cafe-bg/50"
                        title="修改"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(bean)}
                        className="p-1.5 text-cafe-muted hover:text-red-500 rounded-lg hover:bg-red-50"
                        title="刪除"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>確認刪除</DialogTitle>
            <DialogDescription>
              確定要刪除「{deleteTarget?.name}」這筆豆子品項嗎？此操作無法復原。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>取消</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? '刪除中...' : '確認刪除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
