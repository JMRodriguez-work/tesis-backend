export type RecommendationType = 'restock' | 'pricing' | 'trend' | 'seasonal' | 'retention'
export type RecommendationStatus = 'pending' | 'applied' | 'dismissed'
export type RecommendationPriority = 'high' | 'medium' | 'low'

export type RecommendationWithRelations = {
  id: string
  branchId: string
  branch: { id: string; name: string }
  itemId: string | null
  item: { id: string; name: string; code: string | null } | null
  customerId: string | null
  customer: { id: string; fullname: string } | null
  type: RecommendationType
  description: string
  priority: RecommendationPriority
  status: RecommendationStatus
  generatedAt: Date
  expiresAt: Date | null
  readAt: Date | null
}

export type RecommendationListRow = {
  id: string
  branchId: string
  branchName: string
  itemId: string | null
  itemName: string | null
  itemCode: string | null
  customerId: string | null
  customerFullname: string | null
  type: RecommendationType
  description: string
  priority: RecommendationPriority
  status: RecommendationStatus
  generatedAt: Date
  expiresAt: Date | null
  readAt: Date | null
}
