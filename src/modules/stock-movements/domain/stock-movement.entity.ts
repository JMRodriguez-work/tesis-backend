export type StockMovementType = 'in' | 'out' | 'transfer' | 'adjustment'

export type StockMovementWithRelations = {
  id: string
  itemId: string
  item: { id: string; name: string; code: string | null }
  branchId: string
  branch: { id: string; name: string }
  fromWarehouse: { id: string; name: string } | null
  toWarehouse: { id: string; name: string } | null
  type: StockMovementType
  quantity: string
  referenceType: string | null
  referenceId: string | null
  notes: string | null
  createdBy: { id: string; name: string; email: string }
  createdAt: Date
}

export type StockMovementListRow = {
  id: string
  itemId: string
  itemName: string
  itemCode: string | null
  branchId: string
  branchName: string
  fromWarehouseId: string | null
  fromWarehouseName: string | null
  toWarehouseId: string | null
  toWarehouseName: string | null
  type: StockMovementType
  quantity: string
  referenceType: string | null
  referenceId: string | null
  notes: string | null
  createdAt: Date
}

export type StockHistoryRow = StockMovementListRow & {
  runningBalance: string
}

export type LowStockItem = {
  itemId: string
  itemName: string
  itemCode: string | null
  warehouseId: string
  warehouseName: string
  branchId: string
  quantity: string
  minStock: string
  deficit: string
}
