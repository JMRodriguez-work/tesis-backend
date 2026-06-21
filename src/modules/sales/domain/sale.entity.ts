export type SaleStatus = 'active' | 'cancelled'

export type SaleItemWithItem = {
  id: string
  itemId: string
  itemName: string
  itemCode: string | null
  unitId: number | null
  warehouseId: string
  warehouseName: string
  quantity: string
  price: string
  lineTotal: string
}

export type SaleWithRelations = {
  id: string
  branchId: string
  branch: { id: string; name: string }
  customer: { id: string; fullname: string; email: string | null; phone: string | null } | null
  createdBy: { id: string; name: string; email: string }
  total: string
  discountPercent: string
  subtotal: string
  notes: string | null
  isActive: boolean
  status: SaleStatus
  cancellationReason: string | null
  items: SaleItemWithItem[]
  createdAt: Date
  deletedAt: Date | null
}

export type SaleListRow = {
  id: string
  branchId: string
  branchName: string
  customerId: string | null
  customerName: string | null
  total: string
  discountPercent: string
  itemCount: number
  status: SaleStatus
  createdAt: Date
}

export type CustomerPurchaseSummary = {
  totalSpent: string
  purchaseCount: number
  lastPurchaseAt: Date | null
  averageTicket: string
}

export type SaleExportRow = {
  saleId: string
  createdAt: string
  branchName: string
  customerName: string | null
  itemName: string
  itemCode: string | null
  quantity: string
  price: string
  lineTotal: string
  discountPercent: string
  saleTotal: string
  status: SaleStatus
  createdByName: string
}
