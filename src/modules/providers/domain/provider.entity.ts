export type ProviderWithRelations = {
  id: string
  name: string
  companyName: string | null
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  isActive: boolean
  organizationId: string
  createdAt: Date
  updatedAt: Date
}
