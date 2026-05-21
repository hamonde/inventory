-- 新增蝦皮半磅價格欄位（選填，預設 0）
ALTER TABLE beans
  ADD COLUMN price_shopee_half_pound int NOT NULL DEFAULT 0 CHECK (price_shopee_half_pound >= 0);
