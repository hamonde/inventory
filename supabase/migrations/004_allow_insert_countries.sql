-- 允許已登入員工新增國家（原本只有 SELECT policy，缺 INSERT 會被 RLS 擋下）
CREATE POLICY "authenticated_insert_countries" ON countries
  FOR INSERT TO authenticated WITH CHECK (true);
