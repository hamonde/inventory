import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, SlidersHorizontal, RotateCcw, X } from 'lucide-react';
import { greenSupabase } from '@/lib/greenSupabase';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface GreenBean {
  id: string;
  name: string;
  sub_name?: string;
  country?: string;
  region?: string;
  process_method?: string;
}

interface GreenBatch {
  id: string;
  bean_id: string;
  code?: string;
  supplier?: string;
  purchase_date?: string;
  quantity?: number;
  remaining: number;
  notes?: string;
}

type StockFilter = 'all' | 'in_stock' | 'empty';

export default function GreenBeanQueryPage() {
  const navigate = useNavigate();

  const [beans, setBeans] = useState<GreenBean[]>([]);
  const [batches, setBatches] = useState<GreenBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);

  // 篩選
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('in_stock');

  // 篩選視窗
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftSearch, setDraftSearch] = useState('');
  const [draftStock, setDraftStock] = useState<StockFilter>('in_stock');

  useEffect(() => {
    Promise.all([
      greenSupabase.from('beans').select('id, name, sub_name, country, region, process_method'),
      greenSupabase.from('batches').select('id, bean_id, code, supplier, purchase_date, quantity, remaining, notes'),
    ]).then(([{ data: b, error: bErr }, { data: bt, error: btErr }]) => {
      if (bErr || btErr) {
        setAuthError(true);
      } else {
        setBeans((b as GreenBean[]) ?? []);
        setBatches((bt as GreenBatch[]) ?? []);
      }
      setLoading(false);
    });
  }, []);

  const beanMap = useMemo(() => {
    const m: Record<string, GreenBean> = {};
    beans.forEach(b => { m[b.id] = b; });
    return m;
  }, [beans]);

  const rows = useMemo(() => {
    return batches
      .map(bt => ({ batch: bt, bean: beanMap[bt.bean_id] }))
      .filter(({ bean, batch }) => {
        if (!bean) return false;
        if (stockFilter === 'in_stock' && batch.remaining <= 0) return false;
        if (stockFilter === 'empty' && batch.remaining > 0) return false;
        if (search) {
          const q = search.toLowerCase();
          const haystack = [bean.name, bean.sub_name, bean.country, bean.region, bean.process_method, batch.code, batch.supplier].join(' ').toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.batch.remaining - a.batch.remaining);
  }, [batches, beanMap, stockFilter, search]);

  const totalRemaining = useMemo(() =>
    rows.reduce((s, r) => s + (r.batch.remaining ?? 0), 0),
    [rows]
  );

  const activeFilterCount = (search ? 1 : 0) + (stockFilter !== 'in_stock' ? 1 : 0);

  const openFilter = () => {
    setDraftSearch(search);
    setDraftStock(stockFilter);
    setFilterOpen(true);
  };

  const applyFilter = () => {
    setSearch(draftSearch);
    setStockFilter(draftStock);
    setFilterOpen(false);
  };

  const resetDraft = () => {
    setDraftSearch('');
    setDraftStock('in_stock');
  };

  const resetAll = () => {
    setSearch('');
    setStockFilter('in_stock');
    setFilterOpen(false);
  };

  const STOCK_OPTIONS: [StockFilter, string][] = [
    ['in_stock', '有庫存'],
    ['all', '全部'],
    ['empty', '已用完'],
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate(-1)} className="text-cafe-muted hover:text-cafe-dark">
          <ChevronLeft className="h-7 w-7" />
        </button>
        <h1 className="text-xl font-semibold text-cafe-dark">生豆庫存查詢</h1>
        <button
          onClick={openFilter}
          className="ml-auto relative flex items-center gap-1.5 px-4 py-2 rounded-lg border border-cafe-border bg-cafe-cream text-sm text-cafe-dark hover:bg-cafe-border/30 min-h-[44px]"
        >
          <SlidersHorizontal className="h-4 w-4" />
          篩選
          {activeFilterCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-cafe-primary text-cafe-cream text-xs flex items-center justify-center font-semibold">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* 筆數摘要 */}
      {!loading && !authError && (
        <div className="text-xs text-cafe-muted mb-3">
          共 {rows.length} 筆｜合計剩餘 <span className="font-semibold text-cafe-dark">{totalRemaining.toFixed(2)} kg</span>
          {activeFilterCount > 0 && (
            <button onClick={resetAll} className="ml-2 text-cafe-primary underline">清除篩選</button>
          )}
        </div>
      )}

      {authError ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-600 font-medium mb-1">無法連線至生豆系統</p>
          <p className="text-red-500 text-sm">請重新登出後再登入，以重新連線。</p>
        </div>
      ) : loading ? (
        <div className="text-center text-cafe-muted py-12">載入中...</div>
      ) : rows.length === 0 ? (
        <div className="text-center text-cafe-muted py-12">沒有符合條件的紀錄</div>
      ) : (
        <div className="bg-cafe-cream rounded-xl border border-cafe-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cafe-border">
                <th className="text-left px-4 py-3 text-cafe-muted font-medium whitespace-nowrap">豆名</th>
                <th className="text-left px-4 py-3 text-cafe-muted font-medium whitespace-nowrap">批次代號</th>
                <th className="text-left px-4 py-3 text-cafe-muted font-medium whitespace-nowrap">產地</th>
                <th className="text-left px-4 py-3 text-cafe-muted font-medium whitespace-nowrap">處理法</th>
                <th className="text-left px-4 py-3 text-cafe-muted font-medium whitespace-nowrap">豆商</th>
                <th className="text-left px-4 py-3 text-cafe-muted font-medium whitespace-nowrap">進貨日期</th>
                <th className="text-right px-4 py-3 text-cafe-muted font-medium whitespace-nowrap">進貨量 (kg)</th>
                <th className="text-right px-4 py-3 text-cafe-muted font-medium whitespace-nowrap">剩餘庫存 (kg)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ batch, bean }, i) => {
                const isEmpty = batch.remaining <= 0;
                return (
                  <tr key={batch.id} className={`border-b border-cafe-border/50 ${i % 2 === 1 ? 'bg-cafe-bg/10' : ''} ${isEmpty ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 font-medium text-cafe-dark whitespace-nowrap">
                      {bean.name}
                      {bean.sub_name && <span className="ml-1 text-xs text-cafe-muted">({bean.sub_name})</span>}
                    </td>
                    <td className="px-4 py-3 text-cafe-muted whitespace-nowrap">{batch.code || '—'}</td>
                    <td className="px-4 py-3 text-cafe-muted whitespace-nowrap">
                      {[bean.country, bean.region].filter(Boolean).join(' ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-cafe-muted whitespace-nowrap">{bean.process_method || '—'}</td>
                    <td className="px-4 py-3 text-cafe-muted whitespace-nowrap">{batch.supplier || '—'}</td>
                    <td className="px-4 py-3 text-cafe-muted whitespace-nowrap">
                      {batch.purchase_date ? batch.purchase_date.replace(/-/g, '/') : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-cafe-muted whitespace-nowrap">
                      {batch.quantity != null ? batch.quantity.toFixed(2) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold whitespace-nowrap"
                      style={{ color: isEmpty ? '#8B7355' : '#04342C' }}>
                      {isEmpty ? '已用完' : batch.remaining.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 篩選視窗 */}
      {filterOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          {/* 背景遮罩 */}
          <div className="absolute inset-0 bg-black/40" onClick={() => setFilterOpen(false)} />

          {/* 視窗 */}
          <div className="relative w-full sm:max-w-sm bg-cafe-cream rounded-t-2xl sm:rounded-2xl p-6 flex flex-col gap-5 shadow-xl">
            {/* 視窗標題 */}
            <div className="flex items-center justify-between">
              <span className="text-base font-semibold text-cafe-dark">篩選條件</span>
              <button onClick={() => setFilterOpen(false)} className="text-cafe-muted hover:text-cafe-dark">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* 搜尋 */}
            <div>
              <div className="text-sm font-medium text-cafe-dark mb-2">搜尋</div>
              <Input
                placeholder="豆名、產地、豆商…"
                value={draftSearch}
                onChange={e => setDraftSearch(e.target.value)}
                autoFocus
              />
            </div>

            {/* 庫存狀態 */}
            <div>
              <div className="text-sm font-medium text-cafe-dark mb-2">庫存狀態</div>
              <div className="flex gap-2">
                {STOCK_OPTIONS.map(([v, l]) => (
                  <button
                    key={v}
                    onClick={() => setDraftStock(v)}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${draftStock === v ? 'bg-cafe-primary text-cafe-cream' : 'bg-cafe-bg/40 text-cafe-dark hover:bg-cafe-border'}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* 按鈕列 */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={resetDraft}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm text-cafe-muted border border-cafe-border hover:bg-cafe-border/30"
              >
                <RotateCcw className="h-4 w-4" />
                重設
              </button>
              <Button onClick={applyFilter} className="flex-1">
                套用篩選
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
