-- La serie 103.1_I2N_2016_M_19 (IPC GBA, base dic-2016) fue descontinuada por
-- INDEC: su último dato es 2020-07 y, con start_date>=2023, la API de datos
-- abiertos responde 200 con 0 filas. Eso hacía que el fetch terminara en
-- "Parse error: INDEC response has empty data array" y la fuente quedara sin
-- datos (lastError registrado, data nula).
--
-- Se reemplaza por la serie mayorista vigente del INDEC:
--   449.1_NIVEL_GENERAL_0_0_13_97 = "Índice de Precios Internos Básicos al
--   por Mayor" (IPIM/IPIB), nivel general, base dic-2015=100, mensual.
-- Es la referencia declarada en el documento (§Marco teórico, variables
-- externas): los comercios relevados compran a mayoristas.
-- Idempotente: matchea la fuente vieja por nombre o por la URL obsoleta.
UPDATE "external_data_sources"
SET "url" = 'https://apis.datos.gob.ar/series/api/series/?ids=449.1_NIVEL_GENERAL_0_0_13_97&format=json&last=24',
    "name" = 'INDEC Precios mayoristas (IPIM)'
WHERE "type" = 'wholesale_prices'
  AND ("name" = 'INDEC IPC mensual' OR "url" LIKE '%103.1_I2N_2016_M_19%');
