import { useState, useEffect, useRef, useMemo } from 'react';
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

/** 掛耳咖啡包固定清單：dbName = 對應豆子資料表的 name；displayName = 菜單顯示用名稱 */
const DRIP_BAG_ITEMS: { dbName: string; displayName: string }[] = [
  { dbName: '天堂鳥',     displayName: '天堂鳥' },
  { dbName: '耶加雪菲G2', displayName: '耶加雪菲' },
  { dbName: '香水檸檬',   displayName: '香水檸檬' },
  { dbName: '鳳香配方',   displayName: '鳳香配方' },
  { dbName: '桃香配方',   displayName: '桃香配方' },
  { dbName: '粉象',       displayName: '粉象' },
  { dbName: '白葡萄配方', displayName: '白葡萄配方' },
  { dbName: '莓李剉剉',   displayName: '莓李剉剉' },
  { dbName: '荔香配方',   displayName: '荔香配方' },
  { dbName: '露西藝伎',   displayName: '露西藝伎' },
  { dbName: '鑽石山',     displayName: '鑽石山' },
  { dbName: '莫札特',     displayName: '莫札特' },
];
const DRIP_BAG_PRICE = 48;

type ViewMode = 'bean' | 'drip';

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

  const [allBeans, setAllBeans] = useState<Bean[]>([]);
  const [stockedBeans, setStockedBeans] = useState<Bean[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const [mode, setMode] = useState<ViewMode>('bean');

  useEffect(() => {
    Promise.all([
      // 所有販售中的豆子（給掛耳菜單查資料用，因為掛耳豆即使展示櫃沒貨也要顯示）
      supabase.from('beans').select('*').is('deleted_at', null),
      supabase.from('inventory_transactions').select('*'),
    ]).then(([{ data: bData }, { data: tData }]) => {
      const beans = (bData as Bean[]) ?? [];
      const txs = (tData as InventoryTransaction[]) ?? [];
      setAllBeans(beans);
      // 現貨咖啡豆：販售中 + 展示櫃有庫存 + 依半磅價由低到高
      const inStock = beans
        .filter(b => b.status === 'selling' && getBatchesForWarehouse(txs, b.id, 'display').length > 0)
        .sort((a, b) => a.price_half_pound - b.price_half_pound);
      setStockedBeans(inStock);
      setLoading(false);
    });
  }, []);

  /** 掛耳列表：照 DRIP_BAG_ITEMS 順序對應 DB 內豆子（找不到也保留 displayName 顯示） */
  const dripItems = useMemo(() => {
    return DRIP_BAG_ITEMS.map(item => {
      const bean = allBeans.find(b => b.name === item.dbName);
      return { ...item, bean };
    });
  }, [allBeans]);

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
      const tag = mode === 'bean' ? '現貨' : '掛耳';
      a.download = `HAMONDE${tag}菜單_${format(new Date(), 'yyyyMMdd')}.png`;
      a.click();
    } catch {
      showToast('圖片產生失敗，請再試一次', 'error');
    } finally {
      setDownloading(false);
    }
  };

  /* 該模式下的 list 是否為空 */
  const emptyContent = mode === 'bean' && stockedBeans.length === 0;
  const subtitle = mode === 'bean' ? '現貨咖啡豆' : '掛耳咖啡包';

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate(-1)} className="text-cafe-muted hover:text-cafe-dark p-1">
          <ChevronLeft className="h-7 w-7" />
        </button>
        <h1 className="text-xl font-semibold text-cafe-dark">現貨目錄</h1>
        {!loading && !emptyContent && (
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

      {/* 模式切換 */}
      <div className="flex gap-2 mb-4">
        {([
          ['bean', '現貨咖啡豆'],
          ['drip', '掛耳咖啡包'],
        ] as [ViewMode, string][]).map(([v, l]) => (
          <button
            key={v}
            onClick={() => setMode(v)}
            className={`px-4 py-2 rounded-lg text-sm font-medium min-h-[44px] transition-colors ${
              mode === v
                ? 'bg-cafe-primary text-cafe-cream'
                : 'bg-cafe-cream text-cafe-dark border border-cafe-border hover:bg-cafe-border/30'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-cafe-muted py-12">載入中...</div>
      ) : emptyContent ? (
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
                {subtitle}
              </div>
            </div>

            <Divider />

            {/* 列表 */}
            {mode === 'bean' ? (
              <div className="flex flex-col gap-5">
                {stockedBeans.map(bean => (
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
            ) : (
              <div className="flex flex-col gap-5">
                {dripItems.map((item, i) => (
                  <div key={i}>
                    {/* 第一行：豆名 + 虛線 + 價格 */}
                    <div className="flex items-baseline gap-2">
                      <span className="font-medium text-base shrink-0" style={{ color: '#3D2817' }}>
                        {item.displayName}
                      </span>
                      <span
                        className="flex-1 self-center"
                        style={{ borderBottom: '1px dotted #C4B5A0', minWidth: '20px' }}
                      />
                      <span className="font-semibold text-base shrink-0" style={{ color: '#AC6342' }}>
                        ${DRIP_BAG_PRICE}
                      </span>
                    </div>

                    {/* 第二行（若 DB 找得到對應豆子才顯示產地/處理法） */}
                    {item.bean && (
                      <div className="flex items-center gap-1 mt-1" style={{ color: '#8B7355' }}>
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="text-sm">{originLine(item.bean)}</span>
                      </div>
                    )}

                    {/* 第三行：風味 */}
                    {item.bean && item.bean.flavors.length > 0 && (
                      <div className="text-xs mt-0.5" style={{ color: '#A8957C' }}>
                        參考風味：{(item.bean.flavors as string[]).join('、')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <Divider />

            {/* 底部說明 */}
            <div className="text-center">
              <div className="text-xs" style={{ color: '#8B7355' }}>
                {mode === 'bean'
                  ? '以上價格為半磅（約 227g）／ 現貨供應'
                  : '每包約 10g／ 無需器具，熱水沖泡即可享用'}
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
