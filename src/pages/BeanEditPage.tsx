import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, X, ChevronLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import FlavorPickerDialog from '@/components/FlavorPickerDialog';
import OriginPickerDialog from '@/components/OriginPickerDialog';
import { formatOrigin } from '@/lib/origin';
import type { Bean, ProcessCategory, BeanStatus, Origin } from '@/types';

const PROCESS_LABEL: Record<ProcessCategory, string> = {
  sun_dried: '日曬', washed: '水洗', honey: '蜜處理', special: '特殊處理',
};

export default function BeanEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [origins, setOrigins] = useState<Origin[]>([]);
  const [processCategory, setProcessCategory] = useState<ProcessCategory | ''>('');
  const [processDetail, setProcessDetail] = useState('');
  const [processingPlant, setProcessingPlant] = useState('');
  const [flavors, setFlavors] = useState<string[]>([]);
  const [priceDrip, setPriceDrip] = useState('');
  const [priceShopeeHalfPound, setPriceShopeeHalfPound] = useState('');
  const [priceHalfPound, setPriceHalfPound] = useState('');
  const [pricePourOver, setPricePourOver] = useState('');
  const [priceSyphon, setPriceSyphon] = useState('');
  const [status, setStatus] = useState<BeanStatus>('selling');
  const [saving, setSaving] = useState(false);
  const [loadingBean, setLoadingBean] = useState(true);

  const [originOpen, setOriginOpen] = useState(false);
  const [flavorOpen, setFlavorOpen] = useState(false);
  const [processDetails, setProcessDetails] = useState<string[]>([]);
  const [customDetailInput, setCustomDetailInput] = useState('');

  useEffect(() => {
    if (!id) return;
    supabase.from('beans').select('*').eq('id', id).single().then(({ data }) => {
      if (data) {
        const b = data as Bean;
        setName(b.name);
        setOrigins(b.origins);
        setProcessCategory(b.process_category);
        setProcessDetail(b.process_detail ?? '');
        setProcessingPlant(b.processing_plant ?? '');
        setFlavors(b.flavors as string[]);
        setPriceDrip(String(b.price_drip));
        setPriceShopeeHalfPound(String(b.price_shopee_half_pound ?? 0));
        setPriceHalfPound(String(b.price_half_pound));
        setPricePourOver(String(b.price_pour_over));
        setPriceSyphon(String(b.price_syphon));
        setStatus(b.status);
      }
      setLoadingBean(false);
    });
  }, [id]);

  useEffect(() => {
    if (processCategory !== 'honey' && processCategory !== 'special') { setProcessDetails([]); return; }
    supabase.from('custom_process_details').select('name').eq('category', processCategory).then(({ data }) => {
      if (data) setProcessDetails(data.map((r: { name: string }) => r.name));
    });
  }, [processCategory]);

  const isValid = name.trim() && origins.length > 0 && processCategory && flavors.length > 0;

  const handleSave = async () => {
    if (!isValid || !id) return;
    setSaving(true);
    if (processDetail && (processCategory === 'honey' || processCategory === 'special')) {
      await supabase.from('custom_process_details').upsert({ category: processCategory, name: processDetail }, { onConflict: 'category,name', ignoreDuplicates: true });
    }
    const { error } = await supabase.from('beans').update({
      name: name.trim(),
      origins,
      process_category: processCategory,
      process_detail: processDetail || null,
      processing_plant: origins.length === 1 ? (processingPlant || null) : null,
      flavors,
      price_drip: Number(priceDrip) || 0,
      price_shopee_half_pound: Number(priceShopeeHalfPound) || 0,
      price_half_pound: Number(priceHalfPound) || 0,
      price_pour_over: Number(pricePourOver) || 0,
      price_syphon: Number(priceSyphon) || 0,
      status,
    }).eq('id', id);

    setSaving(false);
    if (error) { showToast('儲存失敗', 'error'); return; }
    showToast('已儲存', 'success');
    navigate('/beans');
  };

  if (loadingBean) return <div className="text-cafe-muted text-center py-12">載入中...</div>;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-cafe-muted hover:text-cafe-dark">
          <ChevronLeft className="h-7 w-7" />
        </button>
        <h1 className="text-xl font-semibold text-cafe-dark">修改豆子品項</h1>
      </div>

      <div className="bg-cafe-cream rounded-xl border border-cafe-border p-6 flex flex-col gap-5">

        {/* Origins */}
        <div>
          <Label className="mb-2 block">產地 <span className="text-red-500">*</span></Label>
          {origins.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {origins.map((o, i) => (
                <span key={i} className="flex items-center gap-1 bg-cafe-bg/50 text-cafe-dark text-sm rounded-lg px-3 py-1">
                  {formatOrigin(o)}
                  <button onClick={() => setOrigins(prev => prev.filter((_, j) => j !== i))}><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
          )}
          <Button variant="outline" size="sm" onClick={() => setOriginOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />選擇產地
          </Button>
        </div>

        {origins.length === 1 && (
          <div>
            <Label className="mb-2 block">處理廠</Label>
            <Input placeholder="處理廠名稱（選填）" value={processingPlant} onChange={e => setProcessingPlant(e.target.value)} />
          </div>
        )}

        <div>
          <Label className="mb-2 block">名稱 <span className="text-red-500">*</span></Label>
          <Input value={name} onChange={e => setName(e.target.value)} />
        </div>

        <div>
          <Label className="mb-2 block">處理法 <span className="text-red-500">*</span></Label>
          <div className="flex flex-wrap gap-2">
            {(['sun_dried', 'washed', 'honey', 'special'] as ProcessCategory[]).map(cat => (
              <button
                key={cat}
                onClick={() => { setProcessCategory(cat); setProcessDetail(''); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium min-h-[44px] transition-colors ${processCategory === cat ? 'bg-cafe-primary text-cafe-cream' : 'bg-cafe-bg/40 text-cafe-dark hover:bg-cafe-border'}`}
              >
                {PROCESS_LABEL[cat]}
              </button>
            ))}
          </div>
          {(processCategory === 'honey' || processCategory === 'special') && (
            <div className="mt-3 flex gap-2">
              <Select value={processDetail} onValueChange={v => setProcessDetail(v === '__none__' ? '' : v)}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="選擇細節（選填）" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">不指定</SelectItem>
                  {processDetails.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input
                placeholder="自訂細節"
                className="flex-1"
                value={customDetailInput}
                onChange={e => setCustomDetailInput(e.target.value)}
                onBlur={() => { if (customDetailInput.trim()) setProcessDetail(customDetailInput.trim()); }}
              />
            </div>
          )}
        </div>

        <div>
          <Label className="mb-2 block">參考風味 <span className="text-red-500">*</span></Label>
          {flavors.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {flavors.map(f => (
                <span key={f} className="flex items-center gap-1 bg-cafe-primary/10 text-cafe-primary text-sm rounded-full px-3 py-0.5">
                  {f}<button onClick={() => setFlavors(prev => prev.filter(x => x !== f))}><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
          )}
          <Button variant="outline" size="sm" onClick={() => setFlavorOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />選擇風味
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {[['price_drip', '掛耳價格', priceDrip, setPriceDrip], ['price_shopee_half_pound', '蝦皮半磅', priceShopeeHalfPound, setPriceShopeeHalfPound], ['price_half_pound', '半磅價格', priceHalfPound, setPriceHalfPound], ['price_pour_over', '手沖價格', pricePourOver, setPricePourOver], ['price_syphon', '虹吸價格', priceSyphon, setPriceSyphon]].map(([key, label, val, setter]) => (
            <div key={key as string}>
              <Label className="mb-2 block">{label as string}</Label>
              <Input type="number" min={0} value={val as string} onChange={e => (setter as (v: string) => void)(e.target.value)} />
            </div>
          ))}
        </div>

        <div>
          <Label className="mb-2 block">狀態</Label>
          <div className="flex gap-2">
            {([['selling', '販售中'], ['sold_out', '暫停供應']] as [BeanStatus, string][]).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setStatus(val)}
                className={`px-4 py-2 rounded-lg text-sm font-medium min-h-[44px] transition-colors ${status === val ? 'bg-cafe-primary text-cafe-cream' : 'bg-cafe-bg/40 text-cafe-dark hover:bg-cafe-border'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-2">
          <Button onClick={handleSave} disabled={!isValid || saving}>
            {saving ? '儲存中...' : '儲存'}
          </Button>
        </div>
      </div>

      {/* Origin dialog */}
      <OriginPickerDialog
        open={originOpen}
        onOpenChange={setOriginOpen}
        selectedOrigins={origins}
        onChange={setOrigins}
      />

      {/* Flavor dialog */}
      <FlavorPickerDialog
        open={flavorOpen}
        onOpenChange={setFlavorOpen}
        selectedFlavors={flavors}
        onChange={setFlavors}
      />
    </div>
  );
}
