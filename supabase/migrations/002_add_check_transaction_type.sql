-- 新增盤點確認交易類型
-- 移除舊的 CHECK 約束，重新加上包含 'check' 的版本

ALTER TABLE inventory_transactions
  DROP CONSTRAINT IF EXISTS inventory_transactions_transaction_type_check;

ALTER TABLE inventory_transactions
  ADD CONSTRAINT inventory_transactions_transaction_type_check
  CHECK (transaction_type IN ('in','out','sell','shelf','return','check'));
