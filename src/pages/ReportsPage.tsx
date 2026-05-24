import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronUp, ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { format, startOfMonth, endOfMonth, subMonths, subDays } from 'date-fns';
import type { Bean, InventoryTransaction, ProcessCategory } from '@/types';

const PROCESS_LABEL: Record<ProcessCategory, string> = {
  sun_dried: '日曬', washed: '水洗', honey: '蜜處理', special: '特殊處理',
};

type RangePreset = 'this_month' | 'last_month' | 'last_7' | 'custom';

type SortKey = 'name' | 'sell' | 'out' | 'total' | 'revenue';
type SortDir = 'asc' | 'desc';

interface ReportRow {
  bean: Bean;
  sellQty: number;
  outQty: number;
  totalQty: number;
  revenue: number;
}

export default function ReportsPage() {
  const navigate = useNavigate();

  const [beans, setBeans] = useState<Bean[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const [preset, setPreset] = useState<RangePreset>('this_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const [sortKey, setSortKey] = useState<SortKey>('total');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const [detailBean, setDetailBean] = useState<Bean | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from('beans').select('*').order('name'),
      supabase.from('inventory_transactions').select('*'),
    ]).then(([{ data: bData }, { data: tData }]) => {
      setBeans((bData as Bean[]) ?? []);
      setTransactions((tData as InventoryTransaction[]) ?? []);
      setLoading(false);
    });
  }, []);

  const today = new Date();

  const { dateFrom, dateTo } = useMemo(() => {
    if (preset === 'this_month') return {
      dateFrom: format(startOfMonth(today), 'yyyy-MM-dd'),
      dateTo: format(endOfMonth(today), 'yyyy-MM-dd'),
    };
    if (preset === 'last_month') {
      const lm = subMonths(today, 1);
      return {
        dateFrom: format(startOfMonth(lm), 'yyyy-MM-dd'),
        dateTo: format(endOfMonth(lm), 'yyyy-MM-dd'),
      };
    }
    if (preset === 'last_7') return {
      dateFrom: format(subDays(today, 6), 'yyyy-MM-dd'),
      dateTo: format(today, 'yyyy-MM-dd'),
    };
    // custom
    return { dateFrom: customFrom, dateTo: customTo };
  }, [preset, customFrom, customTo, today]);

  const rows = useMemo<ReportRow[]>(() => {
    if (!dateFrom || !dateTo) return [];

    const filtered = transactions.filter(t => {
      if (t.transaction_type !== 'sell' && t.transaction_type !== 'out') return false;
      return t.transaction_date >= dateFrom && t.transaction_date <= dateTo;
    });

    const map = new Map<string, { sell: number; out: number }>();
    for (const t of filtered) {
      if (!t.bean_id) continue;
      const cur = map.get(t.bean_id) ?? { sell: 0, out: 0 };
      if (t.transaction_type === 'sell') cur.sell += t.qty_half_pound;
      if (t.transaction_type === 'out') cur.out += t.qty_half_pound;
      map.set(t.bean_id, cur);
    }

    return Array.from(map.entries())
      .filter(([, v]) => v.sell + v.out > 0)
      .map(([beanId, v]) => {
        const bean = beans.find(b => b.id === beanId);
        if (!bean) return null;
        const total = v.sell + v.out;
        const revenue = v.sell * (bean.price_half_pound ?? 0);
        return { bean, sellQty: v.sell, outQty: v.out, totalQty: total, revenue } as ReportRow;
      })
      .filter((r): r is ReportRow => r !== null);
  }, [transactions, beans, dateFrom, dateTo]);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      let av = 0, bv = 0;
      if (sortKey === 'name') {
        const cmp = a.bean.name.localeCompare(b.bean.name, 'zh');
        return sortDir === 'asc' ? cmp : -cmp;
      }
      if (sortKey === 'sell') { av = a.sellQty; bv = b.sellQty; }
      if (sortKey === 'out') { av = a.outQty; bv = b.outQty; }
      if (sortKey === 'total') { av = a.totalQty; bv = b.totalQty; }
      if (sortKey === 'revenue') { av = a.revenue; bv = b.revenue; }
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [rows, sortKey, sortDir]);

  const totals = useMemo(() => ({
    sell: rows.reduce((s, r) => s + r.sellQty, 0),
    out: rows.reduce((s, r) => s + r.outQty, 0),
    total: rows.reduce((s, r) => s + r.totalQty, 0),
    revenue: rows.reduce((s, r) => s + r.revenue, 0),
  }), [rows]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ChevronDown className="h-3.5 w-3.5 text-cafe-muted/40 inline ml-0.5" />;
    return sortDir === 'asc'
      ? <ChevronUp className="h-3.5 w-3.5 text-cafe-primary inline ml-0.5" />
      : <ChevronDown className="h-3.5 w-3.5 text-cafe-primary inline ml-0.5" />;
  };

  const PRESETS: { key: RangePreset; label: string }[] = [
    { key: 'this_month', label: '本月' },
    { key: 'last_month', label: '上月' },
    { key: 'last_7', label: '最近 7 天' },
    { key: 'custom', label: '自選區間' },
  ];

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-cafe-muted hover:text-cafe-dark">
          <ChevronLeft className="h-7 w-7" />
        </button>
        <h1 className="text-xl font-semibold text-cafe-dark">消耗報表</h1>
      </div>

      {/* Preset tabs */}
      <div className="bg-cafe-cream rounded-xl border border-cafe-border p-4 mb-4">
        <div className="flex flex-wrap gap-2 mb-3">
          {PRESETS.map(p => (
            <button
              key={p.key}
              onClick={() => setPreset(p.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                preset === p.key
                  ? 'bg-cafe-primary text-cafe-cream'
                  : 'bg-cafe-bg/40 text-cafe-dark hover:bg-cafe-border'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {preset === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 mt-1">
            <div className="flex items-center gap-2">
              <span className="text-sm text-cafe-muted whitespace-nowrap">起始日</span>
              <Input
                type="date"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-cafe-muted whitespace-nowrap">結束日</span>
              <Input
                type="date"
                value={customTo}
                onChange={e => setCustomTo(e.target.value)}
                className="w-40"
              />
            </div>
          </div>
        )}

        {preset !== 'custom' && (
          <div className="text-xs text-cafe-muted">
            {dateFrom.replace(/-/g, '/')} ～ {dateTo.replace(/-/g, '/')}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-cafe-cream rounded-xl border border-cafe-border overflow-hidden">
        {loading ? (
          <div className="text-center text-cafe-muted py-12 text-sm">載入中...</div>
        ) : sorted.length === 0 ? (
          <div className="text-center text-cafe-muted py-12 text-sm">此區間沒有消耗紀錄</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cafe-border bg-cafe-bg/30">
                  <th className="px-4 py-3 text-left font-medium text-cafe-muted">
                    <button onClick={() => handleSort('name')} className="flex items-center gap-0.5 hover:text-cafe-dark">
                      豆名 <SortIcon k="name" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-cafe-muted whitespace-nowrap">
                    <button onClick={() => handleSort('sell')} className="hover:text-cafe-dark">
                      售出量（包）<SortIcon k="sell" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-cafe-muted whitespace-nowrap">
                    <button onClick={() => handleSort('out')} className="hover:text-cafe-dark">
                      出庫量（包）<SortIcon k="out" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-cafe-muted whitespace-nowrap">
                    <button onClick={() => handleSort('total')} className="hover:text-cafe-dark">
                      總消耗（包）<SortIcon k="total" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-cafe-muted whitespace-nowrap">
                    <button onClick={() => handleSort('revenue')} className="hover:text-cafe-dark">
                      售出金額 <SortIcon k="revenue" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cafe-border/50">
                {sorted.map(r => (
                  <tr key={r.bean.id} className="hover:bg-cafe-bg/20 transition-colors">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setDetailBean(r.bean)}
                        className="text-cafe-primary hover:underline text-left font-medium"
                      >
                        {r.bean.name}
                        {r.bean.deleted_at && (
                          <span className="ml-1 text-xs text-cafe-muted font-normal">（已刪除）</span>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center text-cafe-dark">{r.sellQty}</td>
                    <td className="px-4 py-3 text-center text-cafe-dark">{r.outQty}</td>
                    <td className="px-4 py-3 text-center font-semibold text-cafe-dark">{r.totalQty}</td>
                    <td className="px-4 py-3 text-right text-cafe-dark">
                      NT$ {r.revenue.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Totals row */}
              <tfoot>
                <tr className="border-t-2 border-cafe-border bg-cafe-cream">
                  <td className="px-4 py-3 font-semibold text-cafe-dark">合計</td>
                  <td className="px-4 py-3 text-center font-semibold text-cafe-dark">{totals.sell}</td>
                  <td className="px-4 py-3 text-center font-semibold text-cafe-dark">{totals.out}</td>
                  <td className="px-4 py-3 text-center font-bold text-cafe-primary">{totals.total}</td>
                  <td className="px-4 py-3 text-right font-bold text-cafe-primary">
                    NT$ {totals.revenue.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Bean detail dialog */}
      <Dialog open={!!detailBean} onOpenChange={open => !open && setDetailBean(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-start justify-between gap-2 pr-6">
              <span>{detailBean?.name}</span>
              {detailBean?.deleted_at && (
                <span className="text-xs font-normal text-cafe-muted bg-cafe-bg/50 px-2 py-0.5 rounded-full shrink-0">已刪除</span>
              )}
            </DialogTitle>
          </DialogHeader>
          {detailBean && (
            <div className="flex flex-col gap-3 text-sm">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <div className="text-xs text-cafe-muted mb-0.5">產地</div>
                  <div className="text-cafe-dark">
                    {detailBean.origins.map(o => `${o.country}${o.region ? ` ${o.region}` : ''}`).join('、')}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-cafe-muted mb-0.5">處理法</div>
                  <div className="text-cafe-dark">
                    {PROCESS_LABEL[detailBean.process_category]}
                    {detailBean.process_detail && ` · ${detailBean.process_detail}`}
                  </div>
                </div>
                {detailBean.estate && (
                  <div>
                    <div className="text-xs text-cafe-muted mb-0.5">莊園</div>
                    <div className="text-cafe-dark">{detailBean.estate}</div>
                  </div>
                )}
                {detailBean.processing_plant && (
                  <div>
                    <div className="text-xs text-cafe-muted mb-0.5">處理廠</div>
                    <div className="text-cafe-dark">{detailBean.processing_plant}</div>
                  </div>
                )}
                {detailBean.variety && (
                  <div>
                    <div className="text-xs text-cafe-muted mb-0.5">品種</div>
                    <div className="text-cafe-dark">{detailBean.variety}</div>
                  </div>
                )}
                {detailBean.grade && (
                  <div>
                    <div className="text-xs text-cafe-muted mb-0.5">等級</div>
                    <div className="text-cafe-dark">{detailBean.grade}</div>
                  </div>
                )}
                <div>
                  <div className="text-xs text-cafe-muted mb-0.5">半磅售價</div>
                  <div className="text-cafe-dark font-medium">NT$ {detailBean.price_half_pound.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs text-cafe-muted mb-0.5">蝦皮半磅</div>
                  <div className="text-cafe-dark">NT$ {(detailBean.price_shopee_half_pound ?? 0).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs text-cafe-muted mb-0.5">手沖售價</div>
                  <div className="text-cafe-dark">NT$ {detailBean.price_pour_over.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs text-cafe-muted mb-0.5">掛耳售價</div>
                  <div className="text-cafe-dark">NT$ {detailBean.price_drip.toLocaleString()}</div>
                </div>
              </div>
              {detailBean.flavors.length > 0 && (
                <div>
                  <div className="text-xs text-cafe-muted mb-1.5">參考風味</div>
                  <div className="flex flex-wrap gap-1.5">
                    {detailBean.flavors.map(f => (
                      <span key={f} className="text-xs bg-cafe-primary/10 text-cafe-primary rounded-full px-2.5 py-0.5">{f}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailBean(null)}>關閉</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
