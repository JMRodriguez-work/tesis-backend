export type ProviderOrderStatus = 'pending' | 'received' | 'cancelled'

export type ProviderOrderItemWithItem = {
  id: string
  itemId: string
  itemName: string
  itemCode: string | null
  unitId: number | null
  quantity: string
  cost: string
  lineTotal: string
}

export type ProviderOrderWithRelations = {
  id: string
  branchId: string
  branch: { id: string; name: string }
  provider: { id: string; name: string }
  createdBy: { id: string; name: string; email: string }
  status: ProviderOrderStatus
  total: string
  estimatedDelivery: Date | null
  items: ProviderOrderItemWithItem[]
  createdAt: Date
}

export type ProviderOrderListRow = {
  id: string
  branchId: string
  branchName: string
  providerId: string
  providerName: string
  status: ProviderOrderStatus
  total: string
  itemCount: number
  estimatedDelivery: Date | null
  createdAt: Date
}
