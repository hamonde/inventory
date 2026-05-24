-- 莊園改為豆子層級的獨立欄位（選填），不再綁在產地 origins 內
ALTER TABLE beans
  ADD COLUMN estate text;
