-- 新增品種與等級欄位（均選填）
ALTER TABLE beans
  ADD COLUMN variety text,
  ADD COLUMN grade text;
