import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, RotateCcw } from 'lucide-react';
import { greenSupabase } from '@/lib/greenSupabase';
import { Input } from '@/components/ui/input';

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

  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('in_stock');

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

  const resetFilters = () => {
    setSearch('');
    setStockFilter('in_stock');
  };

  const totalRemaining = useMemo(() =>
    rows.reduce((s, r) => s + (r.batch.remaining ?? 0), 0),
    [rows]
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate(-1)} className="text-cafe-muted hover:text-cafe-dark">
          <ChevronLeft className="h-7 w-7" />
        </button>
        <h1 className="text-xl font-semibold text-cafe-dark">生豆庫存查詢</h1>
      </div>

      {authError ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-600 font-medium mb-1">無法連線至生豆系統</p>
          <p className="text-red-500 text-sm">請重新登出後再登入，以重新連線。</p>
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="bg-cafe-cream rounded-xl border border-cafe-border p-4 mb-4 flex flex-col gap-3">
            <div className="flex flex-wrap gap-3 items-end">
              {/* Search */}
              <div className="flex-1 min-w-[180px]">
                <div className="text-xs text-cafe-muted mb-1">搜尋</div>
                <Input
                  placeholder="豆名、產地、豆商…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>

              {/* Stock filter */}
              <div>
                <div className="text-xs text-cafe-muted mb-1">庫存狀態</div>
                <div className="flex gap-1.5">
                  {([['in_stock', '有庫存'], ['all', '全部'], ['empty', '已用完']] as [StockFilter, string][]).map(([v, l]) => (
                    <button
                      key={v}
                      onClick={() => setStockFilter(v)}
                      className={`px-3 py-2 rounded-lg text-sm min-h-[44px] transition-colors ${stockFilter === v ? 'bg-cafe-primary text-cafe-cream' : 'bg-cafe-bg/40 text-cafe-dark hover:bg-cafe-border'}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={resetFilters}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-cafe-muted border border-cafe-border hover:bg-cafe-border/30 min-h-[44px]"
              >
                <RotateCcw className="h-4 w-4" />
                重設
              </button>
            </div>

            {!loading && (
              <div className="text-xs text-cafe-muted">
                共 {rows.length} 筆｜合計剩餘 <span className="font-semibold text-cafe-dark">{totalRemaining.toFixed(2)} kg</span>
              </div>
            )}
          </div>

          {/* Table */}
          {loading ? (
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
        </>
      )}
    </div>
  );
}
