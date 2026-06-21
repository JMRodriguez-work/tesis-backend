export type SalesSummaryBucket = {
  totalSales: string
  transactionCount: number
  averageTicket: string
}

export type SalesSummary = {
  today: {
    date: string
    totalSales: string
    transactionCount: number
    averageTicket: string
  }
  thisWeek: {
    fromDate: string
    toDate: string
    totalSales: string
    transactionCount: number
    averageTicket: string
  }
  previousWeek: {
    fromDate: string
    toDate: string
    totalSales: string
    transactionCount: number
    averageTicket: string
  }
  comparison: {
    totalSalesDelta: number
    transactionCountDelta: number
    averageTicketDelta: number
  }
}

export type ProductRotationRow = {
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

export type UnsoldItem = {
  itemId: string
  itemName: string
  itemCode: string | null
  categoryId: string | null
  categoryName: string | null
}
