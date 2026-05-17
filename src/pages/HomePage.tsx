import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowLeftRight, List, PlusCircle, AlertTriangle, Clock, CircleCheck, History, Coins, PackageOpen, BarChart2, ClipboardList, PackageX } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { calcFreshnessStats, calcLowStockCount } from '@/lib/inventory';
import QuickSellDialog from '@/components/QuickSellDialog';
import QuickShelfDialog from '@/components/QuickShelfDialog';
import type { InventoryTransaction, Bean } from '@/types';

const features = [
  {
    icon: Search,
    title: '查詢豆子庫存',
    description: '查看各豆子在二樓倉庫與展示櫃的庫存數量',
    path: '/inventory',
  },
  {
    icon: ArrowLeftRight,
    title: '進出豆子庫存',
    description: '記錄進庫、出庫、售出、上架、回倉等庫存異動',
    path: '/transaction',
  },
  {
    icon: List,
    title: '查詢豆子品項',
    description: '瀏覽、搜尋、修改或刪除咖啡豆品項資料',
    path: '/beans',
  },
  {
    icon: PlusCircle,
    title: '新增豆子品項',
    description: '建立新咖啡豆品項，設定產地、處理法與價格',
    path: '/beans/new',
  },
];

export default function HomePage() {
  const navigate = useNavigate();
  const [resting, setResting] = useState(0);
  const [expired, setExpired] = useState(0);
  const [lowStock, setLowStock] = useState(0);
  const [alertLoading, setAlertLoading] = useState(true);
  const [quickSellOpen, setQuickSellOpen] = useState(false);
  const [quickShelfOpen, setQuickShelfOpen] = useState(false);

  const loadFreshness = () => {
    Promise.all([
      supabase.from('beans').select('id, status').is('deleted_at', null),
      supabase.from('inventory_transactions').select('*'),
    ]).then(([{ data: beans }, { data: txs }]) => {
      if (beans && txs) {
        const beanList = beans as Pick<Bean, 'id' | 'status'>[];
        const beanIds = beanList.map(b => b.id);
        const txList = txs as InventoryTransaction[];
        const stats = calcFreshnessStats(txList, beanIds);
        setResting(stats.resting);
        setExpired(stats.expired);
        setLowStock(calcLowStockCount(txList, beanList));
      }
      setAlertLoading(false);
    });
  };

  useEffect(() => {
    loadFreshness();
  }, []);

  const allGood = !alertLoading && resting === 0 && expired === 0 && lowStock === 0;

  return (
    <div>
      <h1 className="text-xl font-semibold text-cafe-dark mb-4">功能選單</h1>

      {/* Freshness alert */}
      {!alertLoading && (
        <div className="mb-6">
          {allGood ? (
            <div className="flex items-center gap-3 rounded-xl border border-green-300 bg-green-50 px-4 py-3">
              <CircleCheck className="h-5 w-5 text-green-600 shrink-0" />
              <span className="text-sm font-medium text-green-800">所有豆子狀態正常</span>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {/* Expired card */}
              <button
                onClick={() => navigate('/inventory?filter=expired')}
                className="flex items-center gap-3 rounded-xl border border-cafe-primary px-4 py-3 text-left transition-opacity hover:opacity-80"
                style={{ background: '#FAECE7' }}
              >
                <AlertTriangle className="h-6 w-6 shrink-0" style={{ color: '#AC6342' }} />
                <div>
                  <div className="text-2xl font-bold" style={{ color: '#AC6342' }}>{expired}</div>
                  <div className="text-xs text-cafe-dark mt-0.5">批已滿三個月</div>
                </div>
              </button>

              {/* Resting card */}
              <button
                onClick={() => navigate('/inventory?filter=resting')}
                className="flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-opacity hover:opacity-80"
                style={{ background: '#FAEEDA', borderColor: '#DFCC60' }}
              >
                <Clock className="h-6 w-6 shrink-0" style={{ color: '#854F0B' }} />
                <div>
                  <div className="text-2xl font-bold text-cafe-dark">{resting}</div>
                  <div className="text-xs text-cafe-dark mt-0.5">批正在養豆</div>
                </div>
              </button>

              {/* Low stock card */}
              <button
                onClick={() => navigate('/inventory?filter=low_stock')}
                className="flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-opacity hover:opacity-80"
                style={{ background: '#FDE7E1', borderColor: '#E7452A' }}
              >
                <PackageX className="h-6 w-6 shrink-0" style={{ color: '#E7452A' }} />
                <div>
                  <div className="text-2xl font-bold" style={{ color: '#E7452A' }}>{lowStock}</div>
                  <div className="text-xs text-cafe-dark mt-0.5">種庫存不足</div>
                </div>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <button
          onClick={() => setQuickSellOpen(true)}
          className="flex flex-col items-center justify-center gap-2 rounded-xl py-5 min-h-[88px] transition-opacity hover:opacity-90 active:opacity-80"
          style={{ background: '#AC6342' }}
        >
          <Coins className="h-7 w-7 text-cafe-cream" />
          <span className="text-sm font-semibold text-cafe-cream">快速售出</span>
        </button>
        <button
          onClick={() => setQuickShelfOpen(true)}
          className="flex flex-col items-center justify-center gap-2 rounded-xl py-5 min-h-[88px] transition-opacity hover:opacity-90 active:opacity-80"
          style={{ background: '#DFCC60' }}
        >
          <PackageOpen className="h-7 w-7" style={{ color: '#3D2817' }} />
          <span className="text-sm font-semibold" style={{ color: '#3D2817' }}>快速上架</span>
        </button>
      </div>

      {/* Main feature cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {features.map(({ icon: Icon, title, description, path }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="bg-cafe-cream rounded-xl p-6 text-left hover:bg-[#f0ebe2] active:bg-[#e8e0d5] transition-colors border border-cafe-border min-h-[120px] flex items-start gap-4"
          >
            <div className="w-11 h-11 rounded-lg bg-cafe-primary/10 flex items-center justify-center shrink-0">
              <Icon className="h-6 w-6 text-cafe-primary" />
            </div>
            <div>
              <div className="font-semibold text-cafe-dark text-base mb-1">{title}</div>
              <div className="text-sm text-cafe-muted leading-relaxed">{description}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Secondary: History / Reports / Inventory Check */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          { icon: History, label: '歷史紀錄', path: '/history' },
          { icon: BarChart2, label: '消耗報表', path: '/reports' },
          { icon: ClipboardList, label: '盤點', path: '/inventory-check' },
        ].map(({ icon: Icon, label, path }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="flex flex-col items-center gap-2 bg-cafe-cream rounded-xl border border-cafe-border py-4 hover:bg-[#f0ebe2] transition-colors"
          >
            <div className="w-9 h-9 rounded-lg bg-cafe-muted/10 flex items-center justify-center">
              <Icon className="h-5 w-5 text-cafe-muted" />
            </div>
            <span className="text-xs font-medium text-cafe-dark">{label}</span>
          </button>
        ))}
      </div>

      {/* Dialogs */}
      <QuickSellDialog
        open={quickSellOpen}
        onOpenChange={setQuickSellOpen}
        onSuccess={loadFreshness}
      />
      <QuickShelfDialog
        open={quickShelfOpen}
        onOpenChange={setQuickShelfOpen}
        onSuccess={loadFreshness}
      />
    </div>
  );
}
