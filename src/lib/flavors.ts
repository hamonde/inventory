export interface FlavorSubcategory {
  id: string;
  name: string;
  flavors: string[];
}

export interface FlavorCategory {
  id: string;
  name: string;
  color: string;
  subcategories: FlavorSubcategory[];
}

export const FLAVOR_CATEGORIES: FlavorCategory[] = [
  {
    id: 'fruity',
    name: '果香類',
    color: '#D85A30',
    subcategories: [
      { id: 'berry', name: '莓果', flavors: ['莓果', '黑莓', '覆盆莓', '藍莓', '草莓'] },
      { id: 'dried_fruit', name: '乾果', flavors: ['乾果', '葡萄乾', '黑棗'] },
      { id: 'citrus', name: '柑橘', flavors: ['柑橘', '葡萄柚', '柳橙', '檸檬', '萊姆'] },
      { id: 'other_fruit', name: '其他水果', flavors: ['其他水果', '蘋果', '梨子', '桃子', '櫻桃', '葡萄', '鳳梨', '芒果', '荔枝', '哈密瓜', '木瓜', '百香果', '石榴'] },
    ],
  },
  {
    id: 'floral',
    name: '花香類',
    color: '#E8829A',
    subcategories: [
      { id: 'floral_sub', name: '花香', flavors: ['花香', '茉莉', '玫瑰', '洋甘菊', '薰衣草', '橙花'] },
      { id: 'black_tea', name: '紅茶類', flavors: ['紅茶', '烏龍茶'] },
    ],
  },
  {
    id: 'sweet',
    name: '甜類',
    color: '#D4A017',
    subcategories: [
      { id: 'vanilla', name: '香草類', flavors: ['香草', '楓糖'] },
      { id: 'brown_sugar', name: '黑糖類', flavors: ['黑糖', '糖蜜', '蜂蜜', '焦糖', '太妃糖', '棉花糖'] },
      { id: 'overall_sweet', name: '整體甜感', flavors: ['整體甜感', '甜韻', '甜膩'] },
    ],
  },
  {
    id: 'nutty_cocoa',
    name: '堅果可可類',
    color: '#7A4420',
    subcategories: [
      { id: 'nutty', name: '堅果', flavors: ['堅果', '杏仁', '榛果', '花生', '胡桃'] },
      { id: 'cocoa', name: '可可', flavors: ['可可', '巧克力', '黑巧克力'] },
    ],
  },
  {
    id: 'spices',
    name: '香料類',
    color: '#A32D2D',
    subcategories: [
      { id: 'pungent', name: '辛辣', flavors: ['辛辣', '黑胡椒'] },
      { id: 'pepper', name: '胡椒', flavors: ['胡椒', '茴香'] },
      { id: 'brown_spice', name: '溫和香料', flavors: ['溫和香料', '丁香', '肉桂', '肉豆蔻', '茴香籽'] },
    ],
  },
  {
    id: 'roasted',
    name: '烘焙類',
    color: '#3C3489',
    subcategories: [
      { id: 'pipe_tobacco', name: '菸草', flavors: ['菸草', '雪茄'] },
      { id: 'burnt', name: '焦', flavors: ['焦香', '煙燻', '焦碳', '焦油'] },
      { id: 'cereal', name: '穀物', flavors: ['穀物', '小麥', '麥芽'] },
    ],
  },
  {
    id: 'green_vegetative',
    name: '青草植物類',
    color: '#4A7A10',
    subcategories: [
      { id: 'olive_oil', name: '橄欖油', flavors: ['橄欖油'] },
      { id: 'raw', name: '生豆味', flavors: ['生豆', '草本'] },
      { id: 'green', name: '青草', flavors: ['青草', '豌豆', '青椒', '蔬菜'] },
      { id: 'beany', name: '豆類', flavors: ['豆類'] },
    ],
  },
  {
    id: 'sour_fermented',
    name: '酸 / 發酵類',
    color: '#1D7A5A',
    subcategories: [
      { id: 'sour', name: '酸味', flavors: ['酸味', '酸醋', '檸檬酸', '蘋果酸', '醋酸'] },
      { id: 'alcohol', name: '酒類', flavors: ['酒香', '威士忌', '白蘭地', '葡萄酒'] },
      { id: 'fermented', name: '發酵', flavors: ['發酵', '酵母', '熟成'] },
    ],
  },
  {
    id: 'other',
    name: '其他類',
    color: '#6B6860',
    subcategories: [
      { id: 'papery_musty', name: '紙板霉味', flavors: ['紙板', '霉味', '潮濕'] },
      { id: 'chemical', name: '化學', flavors: ['橡皮', '皮革', '醫藥', '油漆'] },
    ],
  },
];
