/**
 * Compares `salePrice` against `purchasePrice` and returns a warning if
 * the sale price is below the purchase price.
 *
 * Both inputs are decimal strings (Postgres `numeric(15,2)`). Returns
 * `null` when no warning is needed, or a structured warning object that
 * the caller can attach to the response.
 *
 * **Why a warning, not a hard error:** in retail, sometimes a merchant
 * needs to sell below cost (clearance, loss leader, end-of-life). A
 * warning lets the front-end show a confirmation ("Estás vendiendo bajo
 * costo, ¿confirmás?") without blocking the operation.
 */
export type PricingWarning = {
  field: "salePrice"
  message: string
  salePrice: string
  purchasePrice: string
}

export function computePricingWarning(
  salePrice: string | null | undefined,
  purchasePrice: string | null | undefined,
): PricingWarning | null {
  if (salePrice == null || purchasePrice == null) return null;
  const sale = Number(salePrice);
  const purchase = Number(purchasePrice);
  if (!Number.isFinite(sale) || !Number.isFinite(purchase)) return null;
  if (sale >= purchase) return null;

  return {
    field: "salePrice",
    message: `El precio de venta (${salePrice}) es menor al precio de compra (${purchasePrice})`,
    salePrice,
    purchasePrice,
  };
}
