-- 莊園清單（必填 country_id；region_id 選填，新增莊園時若在產區情境下會記錄）
CREATE TABLE estates (
  id serial PRIMARY KEY,
  country_id int NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  region_id int REFERENCES regions(id) ON DELETE SET NULL,
  name_zh text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 同國家內莊園名不重複
CREATE UNIQUE INDEX estates_country_name_unique ON estates(country_id, name_zh);

-- 加速以國家／產區查莊園
CREATE INDEX idx_estates_country ON estates(country_id);
CREATE INDEX idx_estates_region ON estates(region_id);

-- 啟用 RLS：員工可讀可寫
ALTER TABLE estates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_estates" ON estates
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_insert_estates" ON estates
  FOR INSERT TO authenticated WITH CHECK (true);
