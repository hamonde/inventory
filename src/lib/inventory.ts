import { differenceInDays, parseISO } from 'date-fns';
import type { InventoryTransaction, Warehouse } from '@/types';

/** 取得某豆子所有有庫存的批次（跨兩個倉庫加總），回傳 { roastDate, quantity } 陣列 */
export function getAllActiveBatches(
  transactions: InventoryTransaction[],
  beanId: string
): { roastDate: string; quantity: number }[] {
  const roastDates = [...new Set(
    transactions
      .filter(t => t.bean_id === beanId && t.roast_date !== null)
      .map(t => t.roast_date as string)
  )];
  return roastDates
    .map(rd => {
      const qty =
        calculateBatchInventory(transactions, beanId, 'storage', rd) +
        calculateBatchInventory(transactions, beanId, 'display', rd);
      return { roastDate: rd, quantity: qty };
    })
    .filter(b => b.quantity > 0)
    .sort((a, b) => a.roastDate.localeCompare(b.roastDate));
}

/** 計算跨所有豆子的新鮮度統計（養豆中批次數、過期批次數） */
export function calcFreshnessStats(
  transactions: InventoryTransaction[],
  beanIds: string[]
): { resting: number; expired: number } {
  let resting = 0;
  let expired = 0;
  for (const beanId of beanIds) {
    for (const batch of getAllActiveBatches(transactions, beanId)) {
      const days = differenceInDays(new Date(), parseISO(batch.roastDate));
      if (days <= 10) resting++;
      else if (days > 90) expired++;
    }
  }
  return { resting, expired };
}

/** 計算低庫存豆子種數（總數 ≤ 2 且 > 0 的豆子） */
export function calcLowStockCount(
  transactions: InventoryTransaction[],
  beanIds: string[]
): number {
  let count = 0;
  for (const beanId of beanIds) {
    const total = getAllActiveBatches(transactions, beanId).reduce((s, b) => s + b.quantity, 0);
    if (total > 0 && total <= 2) count++;
  }
  return count;
}

export function calculateBatchInventory(
  transactions: InventoryTransaction[],
  beanId: string,
  warehouse: Warehouse,
  roastDate: string
): number {
  return transactions
    .filter(t =>
      t.bean_id === beanId &&
      t.roast_date === roastDate &&
      t.transaction_type !== 'check'
    )
    .reduce((sum, t) => {
      if (t.warehouse_to === warehouse) return sum + t.qty_half_pound;
      if (t.warehouse_from === warehouse) return sum - t.qty_half_pound;
      return sum;
    }, 0);
}

export function calculateWarehouseTotal(
  transactions: InventoryTransaction[],
  beanId: string,
  warehouse: Warehouse
): number {
  const roastDates = [...new Set(
    transactions
      .filter(t => t.bean_id === beanId && t.roast_date !== null)
      .map(t => t.roast_date as string)
  )];
  return roastDates.reduce(
    (sum, rd) => sum + calculateBatchInventory(transactions, beanId, warehouse, rd),
    0
  );
}

export function getBatchesForWarehouse(
  transactions: InventoryTransaction[],
  beanId: string,
  warehouse: Warehouse
): { roastDate: string; quantity: number }[] {
  const roastDates = [...new Set(
    transactions
      .filter(t => t.bean_id === beanId && t.roast_date !== null)
      .map(t => t.roast_date as string)
  )];
  return roastDates
    .map(rd => ({ roastDate: rd, quantity: calculateBatchInventory(transactions, beanId, warehouse, rd) }))
    .filter(b => b.quantity > 0)
    .sort((a, b) => a.roastDate.localeCompare(b.roastDate));
}
