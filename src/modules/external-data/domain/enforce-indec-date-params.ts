/**
 * Inyecta parámetros de fecha dinámicos para fuentes de tipo INDEC
 * (series API de `apis.datos.gob.ar/series/api/series/`).
 *
 * La API de series de INDEC exige `start_date` + `end_date` (formato
 * `YYYY-MM-DD`) o `last=N`. Si la URL almacenada usa la forma legacy
 * `start=YYYY-MM` (rechazada por el upstream actual) o no trae fechas,
 * se sobreescriben con el rango de los últimos 24 meses.
 *
 * Solo aplica a URLs de INDEC: detectadas por host + pathname exactos.
 * Para otras fuentes, la URL se devuelve sin cambios.
 */
export function enforceIndecDateParams(
  url: string,
  now: Date = new Date(),
): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }

  const isIndecSeries =
    parsed.host === "apis.datos.gob.ar" &&
    parsed.pathname === "/series/api/series/";
  if (!isIndecSeries) return url;

  const hasStartDate = parsed.searchParams.has("start_date");
  const hasEndDate = parsed.searchParams.has("end_date");
  const hasLast = parsed.searchParams.has("last");
  if (hasStartDate && hasEndDate) return parsed.toString();
  if (hasLast) return parsed.toString();

  const end = startOfDayIso(now);
  const start = startOfDayIso(addMonths(now, -24));
  parsed.searchParams.set("start_date", start);
  parsed.searchParams.set("end_date", end);
  return parsed.toString();
}

function startOfDayIso(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addMonths(d: Date, months: number): Date {
  const result = new Date(d);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}
