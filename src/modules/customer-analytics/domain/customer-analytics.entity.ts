export type CustomerSegment =
  | 'vip'
  | 'frequent'
  | 'occasional'
  | 'new'
  | 'inactive'
  | 'dormant'

export type CustomerWithPurchaseStats = {
  customerId: string
  fullname: string
  email: string | null
  phone: string | null
  branchId: string
  branchName: string
  lastPurchaseAt: Date | null
  totalSpent: string
  purchaseCount: number
}

export type InactiveCustomerRow = {
  customerId: string
  customerFullname: string
  customerEmail: string | null
  customerPhone: string | null
  branchId: string
  branchName: string
  lastPurchaseAt: Date | null
  daysSinceLastPurchase: number | null
  totalSpent: string
  purchaseCount: number
  recommendationId: string
  recommendationGeneratedAt: Date
}

export type SegmentRow = {
  customerId: string
  customerFullname: string
  email: string | null
  phone: string | null
  branchId: string
  branchName: string
  segment: CustomerSegment
  totalSpent: string
  purchaseCount: number
  lastPurchaseAt: Date | null
}

export type DetectInactiveResult = {
  scanned: number
  created: number
  skipped: number
}
