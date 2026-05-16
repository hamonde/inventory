-- ============================================================
-- HAMONDE CAFE 咖啡豆庫存系統 — 初始化 SQL
-- ============================================================

-- 1. beans（豆子品項主檔）
CREATE TABLE beans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  origins jsonb NOT NULL,
  process_category text NOT NULL CHECK (process_category IN ('sun_dried','washed','honey','special')),
  process_detail text,
  processing_plant text,
  flavors jsonb NOT NULL DEFAULT '[]'::jsonb,
  price_drip int NOT NULL,
  price_half_pound int NOT NULL,
  price_pour_over int NOT NULL,
  price_syphon int NOT NULL,
  status text NOT NULL CHECK (status IN ('selling','sold_out')) DEFAULT 'selling',
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_beans_status ON beans(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_beans_deleted ON beans(deleted_at);

-- 2. inventory_transactions（庫存交易紀錄）
CREATE TABLE inventory_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_type text NOT NULL CHECK (transaction_type IN ('in','out','sell','shelf','return')),
  transaction_date date NOT NULL,
  warehouse_from text CHECK (warehouse_from IN ('storage','display')),
  warehouse_to text CHECK (warehouse_to IN ('storage','display')),
  bean_id uuid NOT NULL REFERENCES beans(id),
  roast_date date NOT NULL,
  qty_half_pound int NOT NULL CHECK (qty_half_pound >= 0),
  qty_150g int NOT NULL DEFAULT 0,
  note text,
  operator_id uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tx_bean_date ON inventory_transactions(bean_id, roast_date);
CREATE INDEX idx_tx_date ON inventory_transactions(transaction_date);

-- 3. custom_flavors（自訂風味）
CREATE TABLE custom_flavors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. custom_process_details（自訂處理法細節）
CREATE TABLE custom_process_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('honey','special')),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category, name)
);

-- 5. countries（國家清單）
CREATE TABLE countries (
  id serial PRIMARY KEY,
  continent text NOT NULL,
  name_zh text NOT NULL UNIQUE,
  name_en text
);

-- 6. regions（產區清單）
CREATE TABLE regions (
  id serial PRIMARY KEY,
  country_id int NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  name_zh text NOT NULL,
  UNIQUE (country_id, name_zh)
);

CREATE INDEX idx_regions_country ON regions(country_id);

-- ============================================================
-- 啟用 Row Level Security
-- ============================================================

ALTER TABLE beans ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_flavors ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_process_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_all" ON beans
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON inventory_transactions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON custom_flavors
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON custom_process_details
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_read_countries" ON countries
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read_regions" ON regions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_insert_regions" ON regions
  FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- 預載國家
-- ============================================================

INSERT INTO countries (continent, name_zh, name_en) VALUES
('非洲', '衣索比亞', 'Ethiopia'),
('非洲', '肯亞', 'Kenya'),
('非洲', '坦尚尼亞', 'Tanzania'),
('非洲', '盧安達', 'Rwanda'),
('非洲', '蒲隆地', 'Burundi'),
('非洲', '烏干達', 'Uganda'),
('中南美洲', '巴西', 'Brazil'),
('中南美洲', '哥倫比亞', 'Colombia'),
('中南美洲', '瓜地馬拉', 'Guatemala'),
('中南美洲', '巴拿馬', 'Panama'),
('中南美洲', '宏都拉斯', 'Honduras'),
('中南美洲', '哥斯大黎加', 'Costa Rica'),
('中南美洲', '薩爾瓦多', 'El Salvador'),
('中南美洲', '尼加拉瓜', 'Nicaragua'),
('中南美洲', '墨西哥', 'Mexico'),
('中南美洲', '秘魯', 'Peru'),
('中南美洲', '玻利維亞', 'Bolivia'),
('亞洲', '印尼', 'Indonesia'),
('亞洲', '葉門', 'Yemen'),
('亞洲', '印度', 'India'),
('亞洲', '越南', 'Vietnam'),
('亞洲', '泰國', 'Thailand'),
('亞洲', '中國', 'China'),
('亞洲', '巴布亞紐幾內亞', 'Papua New Guinea'),
('其他', '夏威夷', 'Hawaii');

-- ============================================================
-- 預載產區
-- ============================================================

INSERT INTO regions (country_id, name_zh)
SELECT c.id, r.name_zh
FROM countries c
JOIN (VALUES
  ('衣索比亞', '耶加雪菲'),
  ('衣索比亞', '西達摩'),
  ('衣索比亞', '谷吉'),
  ('衣索比亞', '利姆'),
  ('衣索比亞', '哈拉'),
  ('衣索比亞', '金比'),
  ('衣索比亞', '孔加'),
  ('衣索比亞', '拾卡'),
  ('衣索比亞', '班奇馬吉'),
  ('肯亞', '涅里'),
  ('肯亞', '奇里尼亞加'),
  ('肯亞', '魯伊魯'),
  ('肯亞', '穆蘭卡'),
  ('哥倫比亞', '慧蘭'),
  ('哥倫比亞', '金迪歐'),
  ('哥倫比亞', '托利馬'),
  ('哥倫比亞', '安蒂奧基亞'),
  ('哥倫比亞', '考卡'),
  ('哥倫比亞', '內華達山區'),
  ('哥倫比亞', '薇菈'),
  ('哥倫比亞', '娜玲瓏'),
  ('哥倫比亞', '卡爾達斯'),
  ('瓜地馬拉', '薇薇特南果'),
  ('瓜地馬拉', '安提瓜'),
  ('瓜地馬拉', '阿提特蘭'),
  ('瓜地馬拉', '法拉漢內斯'),
  ('瓜地馬拉', '聖馬可斯'),
  ('瓜地馬拉', '新東方產區'),
  ('巴拿馬', '波奎特'),
  ('巴拿馬', '伏爾肯'),
  ('巴拿馬', '雷利達'),
  ('巴西', '喜拉朵'),
  ('巴西', '米納斯吉拉斯'),
  ('巴西', '南米納斯'),
  ('巴西', '聖保羅'),
  ('巴西', '巴伊亞'),
  ('哥斯大黎加', '塔拉珠'),
  ('哥斯大黎加', '中央谷地'),
  ('哥斯大黎加', '西部谷地'),
  ('哥斯大黎加', '布倫卡'),
  ('印尼', '曼特寧'),
  ('印尼', '塔瓦湖'),
  ('印尼', '托拉賈'),
  ('印尼', '爪哇'),
  ('印尼', '巴里島'),
  ('葉門', '馬塔利'),
  ('葉門', '伊斯瑪利'),
  ('葉門', '薩那尼'),
  ('中國', '雲南'),
  ('中國', '海南'),
  ('巴布亞紐幾內亞', '維基谷地'),
  ('巴布亞紐幾內亞', '希甘'),
  ('夏威夷', '可娜'),
  ('夏威夷', '卡霧')
) AS r(country, name_zh) ON c.name_zh = r.country;

-- ============================================================
-- 自動更新 updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_beans_updated_at
  BEFORE UPDATE ON beans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
