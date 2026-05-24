import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Coffee, MapPin, Download } from 'lucide-react';
import { format } from 'date-fns';
import html2canvas from 'html2canvas';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { getBatchesForWarehouse } from '@/lib/inventory';
import type { Bean, InventoryTransaction, ProcessCategory } from '@/types';

const PROCESS_LABEL: Record<ProcessCategory, string> = {
  sun_dried: '日曬', washed: '水洗', honey: '蜜處理', special: '特殊處理',
};

/** 產地 + 處理法顯示字串 */
function originLine(bean: Bean): string {
  const proc = bean.process_detail || PROCESS_LABEL[bean.process_category];
  if (bean.origins.length === 0) return proc;
  if (bean.origins.length === 1) {
    const o = bean.origins[0];
    const place = `${o.country}${o.region ? ' ' + o.region : ''}${bean.estate ? ' ' + bean.estate : ''}`;
    return `${place} · ${proc}`;
  }
  // 配方豆：只列國家，頓號連接
  const countries = [...new Set(bean.origins.map(o => o.country))].join('、');
  return `${countries} · ${proc}`;
}

/* 裝飾分隔線 */
function Divider() {
  return (
    <div className="flex items-center justify-center gap-2 my-4">
      <div className="h-px w-16" style={{ background: '#D6C9B8' }} />
      <div className="w-2 h-2 rounded-full" style={{ background: '#DFCC60' }} />
      <div className="h-px w-16" style={{ background: '#D6C9B8' }} />
    </div>
  );
}

export default function MenuPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const menuRef = useRef<HTMLDivElement>(null);

  const [beans, setBeans] = useState<Bean[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from('beans').select('*').eq('status', 'selling').is('deleted_at', null),
      supabase.from('inventory_transactions').select('*'),
    ]).then(([{ data: bData }, { data: tData }]) => {
      const allBeans = (bData as Bean[]) ?? [];
      const txs = (tData as InventoryTransaction[]) ?? [];
      // 只留展示櫃有庫存的，依半磅價格由低到高
      const inStock = allBeans
        .filter(b => getBatchesForWarehouse(txs, b.id, 'display').length > 0)
        .sort((a, b) => a.price_half_pound - b.price_half_pound);
      setBeans(inStock);
      setLoading(false);
    });
  }, []);

  const handleDownload = async () => {
    if (!menuRef.current) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(menuRef.current, {
        scale: 2,
        backgroundColor: '#FBF8F2',
        useCORS: true,
      });
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `HAMONDE現貨菜單_${format(new Date(), 'yyyyMMdd')}.png`;
      a.click();
    } catch {
      showToast('圖片產生失敗，請再試一次', 'error');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate(-1)} className="text-cafe-muted hover:text-cafe-dark p-1">
          <ChevronLeft className="h-7 w-7" />
        </button>
        <h1 className="text-xl font-semibold text-cafe-dark">現貨目錄</h1>
        {!loading && beans.length > 0 && (
          <Button
            onClick={handleDownload}
            disabled={downloading}
            className="ml-auto gap-1.5"
            style={{ background: '#AC6342', color: '#FBF8F2' }}
          >
            <Download className="h-4 w-4" />
            {downloading ? '圖片產生中...' : '下載圖片'}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="text-center text-cafe-muted py-12">載入中...</div>
      ) : beans.length === 0 ? (
        <div className="text-center text-cafe-muted py-12">目前展示櫃沒有現貨豆子</div>
      ) : (
        <div className="flex justify-center">
          {/* 菜單卡片 */}
          <div
            ref={menuRef}
            className="w-full max-w-[580px] rounded-2xl px-8 py-10"
            style={{ background: '#FBF8F2' }}
          >
            {/* 標題區 */}
            <div className="flex flex-col items-center">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mb-3"
                style={{ background: '#AC6342' }}
              >
                <Coffee className="h-8 w-8" style={{ color: '#FBF8F2' }} />
              </div>
              <div
                className="text-[22px] font-semibold whitespace-nowrap"
                style={{ color: '#3D2817', letterSpacing: '0.1em' }}
              >
                HAMONDE CAFE
              </div>
              <div
                className="text-sm mt-1"
                style={{ color: '#8B7355', letterSpacing: '0.3em' }}
              >
                現貨咖啡豆
              </div>
            </div>

            <Divider />

            {/* 豆子列表 */}
            <div className="flex flex-col gap-5">
              {beans.map(bean => (
                <div key={bean.id}>
                  {/* 第一行：豆名 + 虛線 + 半磅價 */}
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium text-base shrink-0" style={{ color: '#3D2817' }}>
                      {bean.name}
                    </span>
                    <span
                      className="flex-1 self-center"
                      style={{ borderBottom: '1px dotted #C4B5A0', minWidth: '20px' }}
                    />
                    <span className="font-semibold text-base shrink-0" style={{ color: '#AC6342' }}>
                      ${bean.price_half_pound}
                    </span>
                  </div>

                  {/* 第二行：產地 + 處理法 */}
                  <div className="flex items-center gap-1 mt-1" style={{ color: '#8B7355' }}>
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="text-sm">{originLine(bean)}</span>
                  </div>

                  {/* 第三行：參考風味 */}
                  {bean.flavors.length > 0 && (
                    <div className="text-xs mt-0.5" style={{ color: '#A8957C' }}>
                      參考風味：{(bean.flavors as string[]).join('、')}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <Divider />

            {/* 底部說明 */}
            <div className="text-center">
              <div className="text-xs" style={{ color: '#8B7355' }}>
                以上價格為半磅（約 227g）／ 現貨供應
              </div>
              <div className="text-[11px] mt-1 leading-relaxed px-4" style={{ color: '#A8957C' }}>
                風味描述會因沖煮方式、水溫、研磨粗細與個人感受略有差異，僅供參考。
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
