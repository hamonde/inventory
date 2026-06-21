-- 掛耳清單（可在前端設定頁維護）
CREATE TABLE drip_bag_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bean_id uuid REFERENCES beans(id) ON DELETE SET NULL,
  display_name text NOT NULL,
  price int NOT NULL DEFAULT 48 CHECK (price >= 0),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_drip_bag_sort ON drip_bag_items(sort_order);

ALTER TABLE drip_bag_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_all_drip_bag_items" ON drip_bag_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 自動更新 updated_at
CREATE TRIGGER update_drip_bag_items_updated_at
  BEFORE UPDATE ON drip_bag_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 種子資料：將原本程式碼中的 12 個品項寫入 DB（若表格目前為空才插入）
INSERT INTO drip_bag_items (bean_id, display_name, price, sort_order)
SELECT
  (SELECT id FROM beans WHERE name = src.db_name LIMIT 1),
  src.display_name,
  48,
  src.sort_order
FROM (VALUES
  ('天堂鳥',     '天堂鳥',      1),
  ('耶加雪菲G2', '耶加雪菲',    2),
  ('香水檸檬',   '香水檸檬',    3),
  ('鳳香配方',   '鳳香配方',    4),
  ('桃香配方',   '桃香配方',    5),
  ('粉象',       '粉象',        6),
  ('白葡萄配方', '白葡萄配方',  7),
  ('莓李剉剉',   '莓李剉剉',    8),
  ('荔香配方',   '荔香配方',    9),
  ('露西藝伎',   '露西藝伎',   10),
  ('鑽石山',     '鑽石山',     11),
  ('莫札特',     '莫札特',     12)
) AS src(db_name, display_name, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM drip_bag_items LIMIT 1);
