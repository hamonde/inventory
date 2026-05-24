import { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, Search, X, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { formatOrigin } from '@/lib/origin';
import type { Country, Region, Origin } from '@/types';

interface OriginPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedOrigins: Origin[];
  onChange: (origins: Origin[]) => void;
}

const CONTINENTS = ['非洲', '中南美洲', '亞洲', '其他'] as const;

export default function OriginPickerDialog({
  open, onOpenChange, selectedOrigins, onChange,
}: OriginPickerDialogProps) {
  const [countries, setCountries] = useState<Country[]>([]);
  const [regionsMap, setRegionsMap] = useState<Record<number, Region[]>>({});

  const [activeContinent, setActiveContinent] = useState<string>('非洲');
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState('');

  const [addingRegion, setAddingRegion] = useState(false);
  const [newRegionInput, setNewRegionInput] = useState('');

  const [addingCountry, setAddingCountry] = useState(false);
  const [newCountryZh, setNewCountryZh] = useState('');
  const [newCountryEn, setNewCountryEn] = useState('');
  const [addingCountrySaving, setAddingCountrySaving] = useState(false);

  const [validationError, setValidationError] = useState('');

  /* ── 載入國家 ───────────────────────────── */
  useEffect(() => {
    if (open) {
      supabase.from('countries').select('*').order('continent').then(({ data }) => {
        if (data) setCountries(data as Country[]);
      });
    }
  }, [open]);

  /* ── 選到國家時載入產區 ─────────────────── */
  useEffect(() => {
    if (!selectedCountry) return;
    if (regionsMap[selectedCountry.id]) return;
    supabase.from('regions').select('*').eq('country_id', selectedCountry.id).then(({ data }) => {
      if (data) setRegionsMap(prev => ({ ...prev, [selectedCountry.id]: data as Region[] }));
    });
  }, [selectedCountry, regionsMap]);

  const countryRegions = selectedCountry ? (regionsMap[selectedCountry.id] ?? []) : [];

  /* ── 搜尋（國家 + 產區） ────────────────── */
  const searchResults = useMemo(() => {
    if (!searchText.trim()) return [];
    const q = searchText.trim().toLowerCase();
    const results: { country: Country; region?: Region }[] = [];
    for (const c of countries) {
      if (c.name_zh.includes(q) || (c.name_en ?? '').toLowerCase().includes(q)) {
        results.push({ country: c });
      }
      for (const r of regionsMap[c.id] ?? []) {
        if (r.name_zh.includes(q)) results.push({ country: c, region: r });
      }
    }
    return results.slice(0, 30);
  }, [searchText, countries, regionsMap]);

  /* 預載所有產區（搜尋模式啟動時） */
  useEffect(() => {
    if (!searchOpen || countries.length === 0) return;
    const missing = countries.filter(c => !regionsMap[c.id]);
    if (missing.length === 0) return;
    Promise.all(
      missing.map(c =>
        supabase.from('regions').select('*').eq('country_id', c.id).then(({ data }) =>
          data ? { id: c.id, regions: data as Region[] } : null
        )
      )
    ).then(results => {
      setRegionsMap(prev => {
        const next = { ...prev };
        results.forEach(r => { if (r) next[r.id] = r.regions; });
        return next;
      });
    });
  }, [searchOpen, countries, regionsMap]);

  /* ── 已選判斷與寫入 ─────────────────────── */
  const isAlreadyAdded = (country: string, region?: string | null) =>
    selectedOrigins.some(o => o.country === country && (o.region ?? null) === (region ?? null));

  const addOrigin = (country: Country, region?: Region | null) => {
    const origin: Origin = { country: country.name_zh, region: region?.name_zh ?? null };
    if (isAlreadyAdded(origin.country, origin.region)) return;
    onChange([...selectedOrigins, origin]);
    setValidationError('');
    setSelectedCountry(null);
  };

  const removeOrigin = (idx: number) => {
    onChange(selectedOrigins.filter((_, i) => i !== idx));
  };

  /* ── 新增產區 ───────────────────────────── */
  const addNewRegion = async () => {
    if (!newRegionInput.trim() || !selectedCountry) return;
    const { data } = await supabase
      .from('regions')
      .insert({ country_id: selectedCountry.id, name_zh: newRegionInput.trim() })
      .select()
      .single();
    if (data) {
      const newRegion = data as Region;
      setRegionsMap(prev => ({
        ...prev,
        [selectedCountry.id]: [...(prev[selectedCountry.id] ?? []), newRegion],
      }));
      addOrigin(selectedCountry, newRegion);
    }
    setNewRegionInput('');
    setAddingRegion(false);
  };

  /* ── 新增國家 ───────────────────────────── */
  const addNewCountry = async () => {
    const zh = newCountryZh.trim();
    const en = newCountryEn.trim();
    if (!zh) return;
    if (countries.some(c => c.name_zh === zh)) {
      setValidationError(`「${zh}」已存在於國家清單`);
      setTimeout(() => setValidationError(''), 3000);
      return;
    }
    setAddingCountrySaving(true);
    const { data, error } = await supabase
      .from('countries')
      .insert({ continent: activeContinent, name_zh: zh, name_en: en || null })
      .select()
      .single();
    setAddingCountrySaving(false);
    if (error || !data) {
      setValidationError(error?.message ? `新增國家失敗：${error.message}` : '新增國家失敗');
      setTimeout(() => setValidationError(''), 5000);
      return;
    }
    setCountries(prev => [...prev, data as Country]);
    setNewCountryZh('');
    setNewCountryEn('');
    setAddingCountry(false);
  };

  /* ── 確認 / 關閉 ────────────────────────── */
  const handleConfirm = () => {
    // 若使用者已選國家但還沒按「+ 加入」，按確定時自動把目前國家加入
    let workingOrigins = selectedOrigins;
    if (selectedCountry) {
      const tentative: Origin = { country: selectedCountry.name_zh, region: null };
      const exists = workingOrigins.some(o =>
        o.country === tentative.country && (o.region ?? null) === tentative.region
      );
      if (!exists) {
        workingOrigins = [...workingOrigins, tentative];
        onChange(workingOrigins);
      }
    }
    if (workingOrigins.length === 0) {
      setValidationError('請至少選擇一個產地');
      return;
    }
    setValidationError('');
    onOpenChange(false);
  };

  const handleOpenChange = (val: boolean) => {
    if (!val) {
      setSelectedCountry(null);
      setSearchOpen(false);
      setSearchText('');
      setValidationError('');
      setAddingRegion(false);
      setAddingCountry(false);
      setNewCountryZh('');
      setNewCountryEn('');
      setNewRegionInput('');
    }
    onOpenChange(val);
  };

  const continentCountries = countries.filter(c => c.continent === activeContinent);

  const titleContent = selectedCountry ? (
    <button
      className="flex items-center gap-1 text-cafe-dark hover:text-cafe-primary"
      onClick={() => { setSelectedCountry(null); setAddingRegion(false); }}
    >
      <ChevronLeft className="h-5 w-5" />
      {selectedCountry.name_zh}
    </button>
  ) : '選擇產地';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-cafe-border shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle>{titleContent}</DialogTitle>
            {!selectedCountry && (
              <button
                onClick={() => { setSearchOpen(v => !v); setSearchText(''); }}
                className="p-2 mr-8 text-cafe-muted hover:text-cafe-dark rounded-lg"
                title="搜尋"
              >
                <Search className="h-5 w-5" />
              </button>
            )}
          </div>
          {searchOpen && !selectedCountry && (
            <Input
              autoFocus
              placeholder="搜尋國家或產區…"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              className="mt-2"
            />
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
          {/* 已選清單 */}
          <div className="rounded-lg bg-cafe-bg/40 px-4 py-3">
            <div className="text-xs font-medium text-cafe-muted mb-2">已選產地</div>
            {selectedOrigins.length === 0 ? (
              <div className="text-xs text-cafe-muted">尚未選擇產地</div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {selectedOrigins.map((o, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 bg-cafe-primary text-cafe-cream text-xs rounded-full px-2.5 py-0.5"
                  >
                    {formatOrigin(o)}
                    <button onClick={() => removeOrigin(i)} className="hover:opacity-70">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {validationError && (
              <p className="text-xs text-red-500 mt-2">{validationError}</p>
            )}
          </div>

          {/* 搜尋結果 */}
          {searchOpen && searchText.trim() ? (
            <div className="flex flex-col gap-1">
              {searchResults.length === 0 ? (
                <div className="text-sm text-cafe-muted text-center py-4">找不到符合的國家或產區</div>
              ) : searchResults.map((r, i) => {
                const already = isAlreadyAdded(r.country.name_zh, r.region?.name_zh);
                const label = `${r.country.name_zh}${r.region ? ' · ' + r.region.name_zh : ''}`;
                return (
                  <button
                    key={i}
                    disabled={already}
                    onClick={() => { addOrigin(r.country, r.region); setSearchText(''); setSearchOpen(false); }}
                    className={`flex items-center justify-between px-4 py-2.5 rounded-lg text-sm text-left transition-colors ${
                      already
                        ? 'bg-cafe-bg/20 text-cafe-muted cursor-not-allowed'
                        : 'bg-cafe-cream border border-cafe-border hover:bg-cafe-border/30 text-cafe-dark'
                    }`}
                  >
                    <span>{label}</span>
                    {already && <span className="text-xs text-cafe-muted">已選</span>}
                  </button>
                );
              })}
            </div>
          ) : selectedCountry ? (
            /* ───── 產區選擇 ───── */
            <div className="flex flex-col gap-2">
              <button
                disabled={isAlreadyAdded(selectedCountry.name_zh, null)}
                onClick={() => addOrigin(selectedCountry)}
                className={`px-4 py-3 rounded-lg text-sm text-left font-medium transition-colors border ${
                  isAlreadyAdded(selectedCountry.name_zh, null)
                    ? 'border-cafe-border text-cafe-muted bg-cafe-bg/20 cursor-not-allowed'
                    : 'border-cafe-primary text-cafe-primary bg-cafe-primary/5 hover:bg-cafe-primary/10'
                }`}
              >
                + 加入此國家（不指定產區）
                {isAlreadyAdded(selectedCountry.name_zh, null) && <span className="ml-2 text-xs">已選</span>}
              </button>

              {countryRegions.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-1">
                  {countryRegions.map(r => {
                    const already = isAlreadyAdded(selectedCountry.name_zh, r.name_zh);
                    return (
                      <button
                        key={r.id}
                        disabled={already}
                        onClick={() => addOrigin(selectedCountry, r)}
                        className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                          already
                            ? 'bg-cafe-bg/30 text-cafe-muted cursor-not-allowed'
                            : 'bg-cafe-cream border border-cafe-border text-cafe-dark hover:bg-cafe-border/40'
                        }`}
                      >
                        {r.name_zh}
                        {already && ' ✓'}
                      </button>
                    );
                  })}
                </div>
              )}

              {addingRegion ? (
                <div className="flex gap-2 mt-1">
                  <Input
                    autoFocus
                    placeholder="新產區名稱"
                    value={newRegionInput}
                    onChange={e => setNewRegionInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addNewRegion()}
                  />
                  <Button size="sm" onClick={addNewRegion} disabled={!newRegionInput.trim()}>新增</Button>
                  <Button size="sm" variant="outline" onClick={() => { setAddingRegion(false); setNewRegionInput(''); }}>取消</Button>
                </div>
              ) : (
                <button
                  className="text-sm text-cafe-primary hover:underline text-left mt-1"
                  onClick={() => setAddingRegion(true)}
                >
                  <Plus className="h-3.5 w-3.5 inline mr-1" />新增產區
                </button>
              )}
            </div>
          ) : (
            /* ───── 洲別 + 國家列表 ───── */
            <>
              <div className="flex gap-1 border-b border-cafe-border pb-3">
                {CONTINENTS.map(c => (
                  <button
                    key={c}
                    onClick={() => setActiveContinent(c)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      activeContinent === c
                        ? 'bg-cafe-primary text-cafe-cream'
                        : 'text-cafe-muted hover:text-cafe-dark hover:bg-cafe-bg/40'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {continentCountries.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCountry(c)}
                    className="px-4 py-3 rounded-lg text-sm text-left bg-cafe-cream border border-cafe-border text-cafe-dark hover:bg-cafe-border/30 transition-colors"
                  >
                    <div className="font-medium">{c.name_zh}</div>
                    {c.name_en && <div className="text-xs text-cafe-muted mt-0.5">{c.name_en}</div>}
                  </button>
                ))}
              </div>

              {/* 新增國家 */}
              {addingCountry ? (
                <div className="flex flex-col gap-2 mt-2 p-3 rounded-lg border border-cafe-border bg-cafe-bg/20">
                  <div className="text-xs text-cafe-muted">新增國家到「{activeContinent}」</div>
                  <Input
                    autoFocus
                    placeholder="國家中文名（必填）"
                    value={newCountryZh}
                    onChange={e => setNewCountryZh(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addNewCountry()}
                  />
                  <Input
                    placeholder="英文名（選填）"
                    value={newCountryEn}
                    onChange={e => setNewCountryEn(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addNewCountry()}
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setAddingCountry(false); setNewCountryZh(''); setNewCountryEn(''); }}
                      disabled={addingCountrySaving}
                    >
                      取消
                    </Button>
                    <Button size="sm" onClick={addNewCountry} disabled={!newCountryZh.trim() || addingCountrySaving}>
                      {addingCountrySaving ? '新增中...' : '新增'}
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  className="text-sm text-cafe-primary hover:underline text-left mt-2"
                  onClick={() => setAddingCountry(true)}
                >
                  <Plus className="h-3.5 w-3.5 inline mr-1" />新增國家到「{activeContinent}」
                </button>
              )}
            </>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-cafe-border shrink-0">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>取消</Button>
          <Button onClick={handleConfirm}>確定</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
