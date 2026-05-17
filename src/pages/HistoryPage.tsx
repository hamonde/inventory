import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, subDays, parseISO } from 'date-fns';
import { ChevronLeft, Download, RotateCcw, ChevronUp, ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { Bean, InventoryTransaction, TransactionType, Warehouse } from '@/types';

// ── 常數 ────────────────────────────────────────────────────
const TX_TYPES: { key: TransactionType; label: string }[] = [
  { key: 'in',     label: '進庫' },
  { key: 'out',    label: '出庫' },
  { key: 'sell',   label: '售出' },
  { key: 'shelf',  label: '上架' },
  { key: 'return', label: '回倉' },
  { key: 'check',  label: '盤點' },
];

const TX_CHIP: Record<TransactionType, { bg: string; color: string }> = {
  in:     { bg: '#9FE1CB', color: '#04342C' },
  out:    { bg: '#F5C4B3', color: '#4A1B0C' },
  sell:   { bg: '#FAC775', color: '#412402' },
  shelf:  { bg: '#B5D4F4', color: '#042C53' },
  return: { bg: '#CECBF6', color: '#26215C' },
  check:  { bg: '#E2E8F0', color: '#334155' },
};

const WAREHOUSE_LABEL: Record<Warehouse, string> = {
  storage: '二樓倉庫',
  display: '展示櫃',
};

const PAGE_SIZE = 50;

function warehouseDisplay(tx: InventoryTransaction): string {
  const type = tx.transaction_type;
  if (type === 'shelf')  return '二樓倉庫 → 展示櫃';
  if (type === 'return') return '展示櫃 → 二樓倉庫';
  if (type === 'check' && tx.warehouse_from) return WAREHOUSE_LABEL[tx.warehouse_from];
  if ((type === 'in') && tx.warehouse_to)   return WAREHOUSE_LABEL[tx.warehouse_to];
  if ((type === 'out' || type === 'sell') && tx.warehouse_from) return WAREHOUSE_LABEL[tx.warehouse_from];
  return '—';
}

function qtyDisplay(tx: InventoryTransaction): { text: string; color: string } {
  const n = tx.qty_half_pound;
  if (tx.transaction_type === 'check') return { text: '—', color: '#8B7355' };
  if (tx.transaction_type === 'in')   return { text: `+${n}`, color: '#04342C' };
  if (tx.transaction_type === 'out' || tx.transaction_type === 'sell')
    return { text: `-${n}`, color: '#4A1B0C' };
  return { text: String(n), color: '#3D2817' };
}

type SortCol = 'transaction_date' | 'qty_half_pound';
type SortDir = 'asc' | 'desc';

// ── 主元件 ──────────────────────────────────────────────────
export default function HistoryPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const today = format(new Date(), 'yyyy-MM-dd');
  const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');

  // 篩選
  const [dateFrom, setDateFrom]         = useState(thirtyDaysAgo);
  const [dateTo, setDateTo]             = useState(today);
  const [beanFilter, setBeanFilter]     = useState('all');
  const [warehouseFilter, setWarehouseFilter] = useState<'all' | Warehouse>('all');
  const [typeFilter, setTypeFilter]     = useState<Set<TransactionType>>(new Set(['in','out','sell','shelf','return','check']));
  const [noteSearch, setNoteSearch]     = useState('');
  const [page, setPage]                 = useState(1);
  const [sortCol, setSortCol]           = useState<SortCol>('transaction_date');
  const [sortDir, setSortDir]           = useState<SortDir>('desc');

  // 資料
  const [txs, setTxs]     = useState<InventoryTransaction[]>([]);
  const [beans, setBeans] = useState<Bean[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from('inventory_transactions').select('*').order('transaction_date', { ascending: false }),
      supabase.from('beans').select('*'),        // 含已軟刪除
    ]).then(([{ data: t }, { data: b }]) => {
      if (t) setTxs(t as InventoryTransaction[]);
      if (b) setBeans(b as Bean[]);
      setLoading(false);
    });
  }, []);

  const beanMap = useMemo(() => {
    const m: Record<string, Bean> = {};
    beans.forEach(b => { m[b.id] = b; });
    return m;
  }, [beans]);

  // 篩選邏輯
  const filtered = useMemo(() => {
    return txs.filter(tx => {
      if (tx.transaction_date < dateFrom || tx.transaction_date > dateTo) return false;
      if (beanFilter !== 'all' && tx.bean_id !== beanFilter) return false;
      if (!typeFilter.has(tx.transaction_type)) return false;
      if (warehouseFilter !== 'all') {
        const involves = tx.warehouse_from === warehouseFilter || tx.warehouse_to === warehouseFilter
          || (tx.transaction_type === 'shelf' && warehouseFilter === 'storage')
          || (tx.transaction_type === 'shelf' && warehouseFilter === 'display')
          || (tx.transaction_type === 'return' && warehouseFilter === 'display')
          || (tx.transaction_type === 'return' && warehouseFilter === 'storage');
        if (!involves) return false;
      }
      if (noteSearch && !tx.note?.toLowerCase().includes(noteSearch.toLowerCase())) return false;
      return true;
    });
  }, [txs, dateFrom, dateTo, beanFilter, typeFilter, warehouseFilter, noteSearch]);

  // 排序
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortCol === 'transaction_date') cmp = a.transaction_date.localeCompare(b.transaction_date);
      if (sortCol === 'qty_half_pound')   cmp = a.qty_half_pound - b.qty_half_pound;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageRows   = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  };

  const SortIcon = ({ col }: { col: SortCol }) => {
    if (sortCol !== col) return <ChevronUp className="h-3 w-3 opacity-30" />;
    return sortDir === 'asc'
      ? <ChevronUp className="h-3 w-3" />
      : <ChevronDown className="h-3 w-3" />;
  };

  const resetFilters = () => {
    setDateFrom(thirtyDaysAgo);
    setDateTo(today);
    setBeanFilter('all');
    setWarehouseFilter('all');
    setTypeFilter(new Set(['in','out','sell','shelf','return','check']));
    setNoteSearch('');
    setPage(1);
  };

  // CSV 匯出
  const exportCSV = () => {
    const header = ['日期','類型','倉庫來源','倉庫目的','豆名','烘豆日期','半磅數量','150g數量','備註','操作員工','建立時間'];
    const typeLabel: Record<TransactionType, string> = { in:'進庫', out:'出庫', sell:'售出', shelf:'上架', return:'回倉', check:'盤點' };
    const whLabel = (w?: Warehouse | null) => w ? WAREHOUSE_LABEL[w] : '';
    const rows = sorted.map(tx => [
      tx.transaction_date,
      typeLabel[tx.transaction_type],
      whLabel(tx.warehouse_from),
      whLabel(tx.warehouse_to),
      tx.bean_id ? (beanMap[tx.bean_id]?.name ?? tx.bean_id) : '—',
      tx.roast_date ?? '—',
      tx.qty_half_pound,
      tx.qty_150g,
      tx.note ?? '',
      tx.operator_id === user?.id ? (user.email?.split('@')[0] ?? tx.operator_id.slice(0,8)) : tx.operator_id.slice(0,8),
      format(parseISO(tx.created_at), 'yyyy/MM/dd HH:mm:ss'),
    ]);
    const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const bom = '﻿';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `HAMONDE_歷史紀錄_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate(-1)} className="text-cafe-muted hover:text-cafe-dark">
          <ChevronLeft className="h-7 w-7" />
        </button>
        <h1 className="text-xl font-semibold text-cafe-dark">歷史紀錄</h1>
      </div>

      {/* Filters */}
      <div className="bg-cafe-cream rounded-xl border border-cafe-border p-4 mb-4 flex flex-col gap-4">
        {/* Row 1: dates + bean + warehouse */}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex items-center gap-2">
            <div>
              <div className="text-xs text-cafe-muted mb-1">起始日</div>
              <input
                type="date"
                value={dateFrom}
                max={dateTo}
                onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                className="h-11 rounded-lg border border-cafe-border bg-cafe-cream px-3 text-sm text-cafe-dark focus:outline-none focus:ring-2 focus:ring-cafe-primary/50"
              />
            </div>
            <span className="text-cafe-muted mt-5">—</span>
            <div>
              <div className="text-xs text-cafe-muted mb-1">結束日</div>
              <input
                type="date"
                value={dateTo}
                min={dateFrom}
                onChange={e => { setDateTo(e.target.value); setPage(1); }}
                className="h-11 rounded-lg border border-cafe-border bg-cafe-cream px-3 text-sm text-cafe-dark focus:outline-none focus:ring-2 focus:ring-cafe-primary/50"
              />
            </div>
          </div>

          {/* Bean filter */}
          <div className="min-w-[160px]">
            <div className="text-xs text-cafe-muted mb-1">豆名</div>
            <Select value={beanFilter} onValueChange={v => { setBeanFilter(v); setPage(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部豆子</SelectItem>
                {beans.map(b => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}{b.deleted_at ? '（已刪除）' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Warehouse filter */}
          <div>
            <div className="text-xs text-cafe-muted mb-1">倉庫</div>
            <div className="flex gap-1.5">
              {([['all','全部'],['storage','二樓倉庫'],['display','展示櫃']] as [string,string][]).map(([v,l]) => (
                <button
                  key={v}
                  onClick={() => { setWarehouseFilter(v as 'all' | Warehouse); setPage(1); }}
                  className={`px-3 py-2 rounded-lg text-sm min-h-[44px] transition-colors ${warehouseFilter === v ? 'bg-cafe-primary text-cafe-cream' : 'bg-cafe-bg/40 text-cafe-dark hover:bg-cafe-border'}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Row 2: type chips + note search */}
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <div className="text-xs text-cafe-muted mb-1">類型</div>
            <div className="flex gap-1.5 flex-wrap">
              {TX_TYPES.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => {
                    setTypeFilter(prev => {
                      const next = new Set(prev);
                      next.has(key) ? next.delete(key) : next.add(key);
                      return next;
                    });
                    setPage(1);
                  }}
                  className={`px-3 py-2 rounded-lg text-sm min-h-[44px] transition-colors border ${typeFilter.has(key) ? 'border-cafe-primary text-cafe-primary' : 'border-cafe-border text-cafe-muted'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 min-w-[180px]">
            <div className="text-xs text-cafe-muted mb-1">搜尋備註</div>
            <Input
              placeholder="輸入關鍵字…"
              value={noteSearch}
              onChange={e => { setNoteSearch(e.target.value); setPage(1); }}
            />
          </div>
        </div>

        {/* Row 3: actions */}
        <div className="flex gap-3">
          <button
            onClick={resetFilters}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-cafe-muted border border-cafe-border hover:bg-cafe-border/30 min-h-[44px]"
          >
            <RotateCcw className="h-4 w-4" />
            重設篩選
          </button>
          <Button onClick={exportCSV} className="gap-1.5">
            <Download className="h-4 w-4" />
            匯出 CSV（{filtered.length} 筆）
          </Button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center text-cafe-muted py-12">載入中...</div>
      ) : sorted.length === 0 ? (
        <div className="text-center text-cafe-muted py-12">沒有符合條件的紀錄</div>
      ) : (
        <>
          <div className="bg-cafe-cream rounded-xl border border-cafe-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cafe-border">
                  <th
                    className="text-left px-4 py-3 text-cafe-muted font-medium whitespace-nowrap cursor-pointer hover:text-cafe-dark"
                    onClick={() => toggleSort('transaction_date')}
                  >
                    <span className="inline-flex items-center gap-1">日期 <SortIcon col="transaction_date" /></span>
                  </th>
                  <th className="text-left px-4 py-3 text-cafe-muted font-medium whitespace-nowrap">類型</th>
                  <th className="text-left px-4 py-3 text-cafe-muted font-medium whitespace-nowrap">倉庫</th>
                  <th className="text-left px-4 py-3 text-cafe-muted font-medium whitespace-nowrap">豆名</th>
                  <th className="text-left px-4 py-3 text-cafe-muted font-medium whitespace-nowrap">烘豆日期</th>
                  <th
                    className="text-right px-4 py-3 text-cafe-muted font-medium whitespace-nowrap cursor-pointer hover:text-cafe-dark"
                    onClick={() => toggleSort('qty_half_pound')}
                  >
                    <span className="inline-flex items-center gap-1 justify-end">半磅數量 <SortIcon col="qty_half_pound" /></span>
                  </th>
                  <th className="text-left px-4 py-3 text-cafe-muted font-medium">備註</th>
                  <th className="text-left px-4 py-3 text-cafe-muted font-medium whitespace-nowrap">操作員工</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((tx, i) => {
                  const bean = tx.bean_id ? beanMap[tx.bean_id] : undefined;
                  const qty = qtyDisplay(tx);
                  const chip = TX_CHIP[tx.transaction_type];
                  const typeLabel = TX_TYPES.find(t => t.key === tx.transaction_type)?.label ?? tx.transaction_type;
                  const operatorName = tx.operator_id === user?.id
                    ? (user.email?.split('@')[0] ?? tx.operator_id.slice(0, 8))
                    : tx.operator_id.slice(0, 8);

                  return (
                    <tr key={tx.id} className={`border-b border-cafe-border/50 ${i % 2 === 1 ? 'bg-cafe-bg/10' : ''}`}>
                      <td className="px-4 py-3 text-cafe-dark whitespace-nowrap">
                        {tx.transaction_date.replace(/-/g, '/')}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
                          style={{ background: chip.bg, color: chip.color }}
                        >
                          {typeLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-cafe-muted whitespace-nowrap">{warehouseDisplay(tx)}</td>
                      <td className="px-4 py-3 font-medium text-cafe-dark whitespace-nowrap">
                        {tx.bean_id === null ? <span className="text-cafe-muted">—</span> : bean ? bean.name : tx.bean_id.slice(0, 8)}
                        {bean?.deleted_at && <span className="ml-1 text-xs text-cafe-muted">（已刪除）</span>}
                      </td>
                      <td className="px-4 py-3 text-cafe-muted whitespace-nowrap">
                        {tx.roast_date ? tx.roast_date.replace(/-/g, '/') : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold whitespace-nowrap" style={{ color: qty.color }}>
                        {qty.text}
                      </td>
                      <td className="px-4 py-3 text-cafe-muted max-w-[160px] truncate">{tx.note || '—'}</td>
                      <td className="px-4 py-3 text-cafe-muted whitespace-nowrap">{operatorName}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-cafe-muted">
              <span>共 {sorted.length} 筆，第 {page} / {totalPages} 頁</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg border border-cafe-border hover:bg-cafe-border/30 disabled:opacity-40 min-h-[36px]"
                >
                  上一頁
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 rounded-lg border border-cafe-border hover:bg-cafe-border/30 disabled:opacity-40 min-h-[36px]"
                >
                  下一頁
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
