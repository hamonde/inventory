-- 允許盤點確認紀錄不綁定特定豆子批次
ALTER TABLE inventory_transactions ALTER COLUMN bean_id DROP NOT NULL;
ALTER TABLE inventory_transactions ALTER COLUMN roast_date DROP NOT NULL;
