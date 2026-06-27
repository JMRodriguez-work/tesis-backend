export type UnitType = 'count' | 'weight' | 'volume';

const countFormatter = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const decimalFormatter = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
});

export function parseDecimalString(value: string | number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function formatQuantity(
  value: string | number,
  unitType: UnitType | null | undefined,
): string {
  const n = parseDecimalString(value);
  if (unitType === 'count') {
    return countFormatter.format(n);
  }
  return decimalFormatter.format(n);
}

const PLURAL_EXCEPTIONS: Record<string, string> = {
  unidad: 'unidades',
};

export function pluralizeUnit(name: string, n: number): string {
  if (!name) return name;
  if (n === 1) return name;
  const lower = name.toLowerCase();
  if (PLURAL_EXCEPTIONS[lower]) return PLURAL_EXCEPTIONS[lower];
  if (/(?:[aeiouáéíóú])$/i.test(lower)) return `${name}s`;
  return `${name}es`;
}

export function formatQuantityWithUnit(
  value: string | number,
  unitType: UnitType | null | undefined,
  unitName: string | null | undefined,
  unitAbbreviation: string | null | undefined,
): string {
  const numStr = formatQuantity(value, unitType);
  const n = parseDecimalString(value);
  if (unitType === 'count' && unitName) {
    return `${numStr} ${pluralizeUnit(unitName, n)}`;
  }
  if ((unitType === 'weight' || unitType === 'volume') && unitAbbreviation) {
    return `${numStr} ${unitAbbreviation}`;
  }
  return numStr;
}
