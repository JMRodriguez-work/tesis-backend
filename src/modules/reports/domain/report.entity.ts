export type TrendInterval = 'day' | 'week' | 'month'
export type TopItemSortBy = 'quantity' | 'revenue'

export type TrendBucket = {
  bucket: string
  totalSales: string
}

export type SalesTrendBucket = TrendBucket & {
  transactionCount: number
}

export type TopItemRow = {
  itemId: string
  itemName: string
  itemCode: string | null
  categoryId: string | null
  categoryName: string | null
  totalQuantitySold: string
  totalRevenue: string
  transactionCount: number
  lastSoldAt: string | null
}

export type CategoryDistributionRow = {
  categoryId: string | null
  categoryName: string
  totalRevenue: string
  transactionCount: number
  itemCount: number
}
