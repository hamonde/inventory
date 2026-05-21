export type Warehouse = 'storage' | 'display';

export type TransactionType = 'in' | 'out' | 'sell' | 'shelf' | 'return' | 'check';

export type ProcessCategory = 'sun_dried' | 'washed' | 'honey' | 'special';

export type BeanStatus = 'selling' | 'sold_out';

export interface Origin {
  country: string;
  region?: string | null;
  estate?: string | null;
}

export interface Bean {
  id: string;
  name: string;
  origins: Origin[];
  process_category: ProcessCategory;
  process_detail?: string | null;
  processing_plant?: string | null;
  flavors: string[];
  price_drip: number;
  price_shopee_half_pound: number;
  price_half_pound: number;
  price_pour_over: number;
  price_syphon: number;
  status: BeanStatus;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryTransaction {
  id: string;
  transaction_type: TransactionType;
  transaction_date: string;
  warehouse_from?: Warehouse | null;
  warehouse_to?: Warehouse | null;
  bean_id: string | null;
  roast_date: string | null;
  qty_half_pound: number;
  qty_150g: number;
  note?: string | null;
  operator_id: string;
  created_at: string;
}

export interface PendingTransaction extends Omit<InventoryTransaction, 'id' | 'operator_id' | 'created_at'> {
  tempId: string;
}

export interface BatchInventory {
  bean_id: string;
  warehouse: Warehouse;
  roast_date: string;
  quantity: number;
}

export interface Country {
  id: number;
  continent: string;
  name_zh: string;
  name_en?: string;
}

export interface Region {
  id: number;
  country_id: number;
  name_zh: string;
}

export interface Estate {
  id: number;
  country_id: number;
  region_id?: number | null;
  name_zh: string;
}
