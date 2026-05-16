import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
import type { Bean, ProcessCategory, BeanStatus, Origin } from '@/types';

const PROCESS_LABEL: Record<ProcessCategory, string> = {
  sun_dried: '日曬',
  washed: '水洗',
  honey: '蜜處理',
  special: '特殊處理',
};

interface BeanFormState {
  name: string;
  origins: Origin[];
  process_category: ProcessCategory | '';
  process_detail: string;
  processing_plant: string;
  flavors: string[];
  price_drip: string;
  price_half_pound: string;
  price_pour_over: string;
  price_syphon: string;
  status: BeanStatus;
}

function emptyForm(): BeanFormState {
  return {
    name: '',
    origins: [],
    process_category: '',
    process_detail: '',
    processing_plant: '',
    flavors: [],
    price_drip: '',
    price_half_pound: '',
    price_pour_over: '',
    price_syphon: '',
    status: 'selling',
  };
}

export default function BeanCreatePage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [pending, setPending] = useState<(BeanFormState & { tempId: string })[]>([]);
  const [form, setForm] = useState<BeanFormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  // Origin dialog
  const [originOpen, setOriginOpen] = useState(false);

  // Flavor dialog
  const [flavorOpen, setFlavorOpen] = useState(false);

  // Process detail
  const [processDetails, setProcessDetails] = useState<string[]>([]);
  const [customDetailInput, setCustomDetailInput] = useState('');

  useEffect(() => {
    const cat = form.process_category;
    if (cat !== 'honey' && cat !== 'special') { setProcessDetails([]); return; }
    supabase.from('custom_process_details').select('name').eq('category', cat).then(({ data }) => {
      if (data) setProcessDetails(data.map((r: { name: string }) => r.name));
    });
    setForm(f => ({ ...f, process_detail: '' }));
    setCustomDetailInput('');
  }, [form.process_category]);

  const isFormValid = () => {
    return (
      form.name.trim() &&
      form.origins.length > 0 &&
      form.process_category &&
      form.flavors.length > 0
    );
  };

  const addToPending = () => {
    if (!isFormValid()) return;
    setPending(prev => [...prev, { ...form, tempId: Math.random().toString(36).slice(2) }]);
    setForm(emptyForm());
  };

  const saveAll = async () => {
    if (pending.length === 0) return;
    setSaving(true);
    try {
      for (const item of pending) {
        const { process_detail, process_category } = item;

        if (process_detail && (process_category === 'honey' || process_category === 'special')) {
          await supabase.from('custom_process_details')
            .upsert({ category: process_category, name: process_detail }, { onConflict: 'category,name', ignoreDuplicates: true });
        }

        const bean: Omit<Bean, 'id' | 'created_at' | 'updated_at' | 'deleted_at'> = {
          name: item.name.trim(),
          origins: item.origins,
          process_category: process_category as ProcessCategory,
          process_detail: process_detail || null,
          processing_plant: item.origins.length === 1 ? (item.processing_plant || null) : null,
          flavors: item.flavors,
          price_drip: Number(item.price_drip) || 0,
          price_half_pound: Number(item.price_half_pound) || 0,
          price_pour_over: Number(item.price_pour_over) || 0,
          price_syphon: Number(item.price_syphon) || 0,
          status: item.status,
        };
        const { error } = await supabase.from('beans').insert(bean);
        if (error) throw error;
      }
      showToast(`已新增 ${pending.length} 筆豆子品項`, 'success');
      setPending([]);
      navigate('/beans');
    } catch {
      showToast('儲存失敗，請再試一次', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-cafe-muted hover:text-cafe-dark">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-semibold text-cafe-dark">新增豆子品項</h1>
      </div>

      {/* Pending table */}
      {pending.length > 0 && (
        <div className="bg-cafe-cream rounded-xl border border-cafe-border p-4 mb-6">
          <div className="font-medium text-cafe-dark mb-3">待新增清單（{pending.length} 筆）</div>
          <div className="flex flex-col gap-2">
            {pending.map(item => (
              <div key={item.tempId} className="flex items-center justify-between text-sm bg-cafe-bg/30 rounded-lg px-3 py-2">
                <span className="text-cafe-dark font-medium">{item.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-cafe-muted">{item.origins.map(o => `${o.country}${o.region ? ' ' + o.region : ''}`).join('、')}</span>
                  <button
                    onClick={() => setPending(prev => prev.filter(p => p.tempId !== item.tempId))}
                    className="text-cafe-muted hover:text-red-500"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-3 mt-4">
            <Button onClick={saveAll} disabled={saving}>
              {saving ? '儲存中...' : `儲存到資料庫（${pending.length} 筆）`}
            </Button>
            <Button variant="outline" onClick={() => setPending([])}>清空清單</Button>
          </div>
        </div>
      )}

      {/* Form */}
      <div className="bg-cafe-cream rounded-xl border border-cafe-border p-6 flex flex-col gap-5">

        {/* Origins */}
        <div>
          <Label className="mb-2 block">產地 <span className="text-red-500">*</span></Label>
          {form.origins.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {form.origins.map((o, i) => (
                <span key={i} className="flex items-center gap-1 bg-cafe-bg/50 text-cafe-dark text-sm rounded-lg px-3 py-1">
                  {o.country}{o.region ? ` ${o.region}` : ''}
                  <button onClick={() => setForm(f => ({ ...f, origins: f.origins.filter((_, j) => j !== i) }))}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <Button variant="outline" size="sm" onClick={() => setOriginOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />選擇產地
          </Button>
        </div>

        {/* Processing plant — only when single origin */}
        {form.origins.length === 1 && (
          <div>
            <Label className="mb-2 block">處理廠</Label>
            <Input
              placeholder="處理廠名稱（選填）"
              value={form.processing_plant}
              onChange={e => setForm(f => ({ ...f, processing_plant: e.target.value }))}
            />
          </div>
        )}

        {/* Name */}
        <div>
          <Label className="mb-2 block">名稱 <span className="text-red-500">*</span></Label>
          <Input
            placeholder="咖啡豆名稱"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />
        </div>

        {/* Process category */}
        <div>
          <Label className="mb-2 block">處理法 <span className="text-red-500">*</span></Label>
          <div className="flex flex-wrap gap-2">
            {(['sun_dried', 'washed', 'honey', 'special'] as ProcessCategory[]).map(cat => (
              <button
                key={cat}
                onClick={() => setForm(f => ({ ...f, process_category: cat, process_detail: '' }))}
                className={`px-4 py-2 rounded-lg text-sm font-medium min-h-[44px] transition-colors ${
                  form.process_category === cat
                    ? 'bg-cafe-primary text-cafe-cream'
                    : 'bg-cafe-bg/40 text-cafe-dark hover:bg-cafe-border'
                }`}
              >
                {PROCESS_LABEL[cat]}
              </button>
            ))}
          </div>

          {/* Process detail for honey / special */}
          {(form.process_category === 'honey' || form.process_category === 'special') && (
            <div className="mt-3 flex gap-2">
              <Select
                value={form.process_detail}
                onValueChange={v => setForm(f => ({ ...f, process_detail: v === '__none__' ? '' : v }))}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="選擇細節（選填）" />
                </SelectTrigger>
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
                onBlur={() => {
                  if (customDetailInput.trim()) setForm(f => ({ ...f, process_detail: customDetailInput.trim() }));
                }}
              />
            </div>
          )}
        </div>

        {/* Flavors */}
        <div>
          <Label className="mb-2 block">參考風味 <span className="text-red-500">*</span></Label>
          {form.flavors.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {form.flavors.map(f => (
                <span key={f} className="flex items-center gap-1 bg-cafe-primary/10 text-cafe-primary text-sm rounded-full px-3 py-0.5">
                  {f}
                  <button onClick={() => setForm(prev => ({ ...prev, flavors: prev.flavors.filter(x => x !== f) }))}><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
          )}
          <Button variant="outline" size="sm" onClick={() => setFlavorOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />選擇風味
          </Button>
        </div>

        {/* Prices */}
        <div className="grid grid-cols-2 gap-4">
          {[
            { key: 'price_drip', label: '掛耳價格' },
            { key: 'price_half_pound', label: '半磅價格' },
            { key: 'price_pour_over', label: '手沖價格' },
            { key: 'price_syphon', label: '虹吸價格' },
          ].map(({ key, label }) => (
            <div key={key}>
              <Label className="mb-2 block">{label}</Label>
              <Input
                type="number"
                min={0}
                placeholder="0"
                value={form[key as keyof BeanFormState] as string}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
              />
            </div>
          ))}
        </div>

        {/* Status */}
        <div>
          <Label className="mb-2 block">狀態 <span className="text-red-500">*</span></Label>
          <div className="flex gap-2">
            {([['selling', '販售中'], ['sold_out', '售完']] as [BeanStatus, string][]).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setForm(f => ({ ...f, status: val }))}
                className={`px-4 py-2 rounded-lg text-sm font-medium min-h-[44px] transition-colors ${
                  form.status === val
                    ? 'bg-cafe-primary text-cafe-cream'
                    : 'bg-cafe-bg/40 text-cafe-dark hover:bg-cafe-border'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button onClick={addToPending} disabled={!isFormValid()}>
            <Plus className="h-4 w-4 mr-1" />加入清單
          </Button>
          {pending.length === 0 && (
            <Button
              variant="outline"
              disabled={!isFormValid() || saving}
              onClick={async () => {
                if (!isFormValid()) return;
                setSaving(true);
                try {
                  const { process_detail, process_category } = form;
                  if (process_detail && (process_category === 'honey' || process_category === 'special')) {
                    await supabase.from('custom_process_details')
                      .upsert({ category: process_category, name: process_detail }, { onConflict: 'category,name', ignoreDuplicates: true });
                  }
                  const { error } = await supabase.from('beans').insert({
                    name: form.name.trim(),
                    origins: form.origins,
                    process_category: form.process_category as ProcessCategory,
                    process_detail: process_detail || null,
                    processing_plant: form.origins.length === 1 ? (form.processing_plant || null) : null,
                    flavors: form.flavors,
                    price_drip: Number(form.price_drip) || 0,
                    price_half_pound: Number(form.price_half_pound) || 0,
                    price_pour_over: Number(form.price_pour_over) || 0,
                    price_syphon: Number(form.price_syphon) || 0,
                    status: form.status,
                  });
                  if (error) throw error;
                  showToast('已新增豆子品項', 'success');
                  navigate('/beans');
                } catch {
                  showToast('儲存失敗，請再試一次', 'error');
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? '儲存中...' : '直接儲存'}
            </Button>
          )}
        </div>
      </div>

      {/* Origin dialog */}
      <OriginPickerDialog
        open={originOpen}
        onOpenChange={setOriginOpen}
        selectedOrigins={form.origins}
        onChange={origins => setForm(f => ({ ...f, origins }))}
      />

      {/* Flavor dialog */}
      <FlavorPickerDialog
        open={flavorOpen}
        onOpenChange={setFlavorOpen}
        selectedFlavors={form.flavors}
        onChange={flavors => setForm(f => ({ ...f, flavors }))}
      />
    </div>
  );
}
