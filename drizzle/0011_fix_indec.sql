UPDATE "external_data_sources"
SET "url" = 'https://apis.datos.gob.ar/series/api/series/?ids=103.1_I2N_2016_M_19&format=json&start_date=2023-01-01&last=24'
WHERE "name" = 'INDEC IPC mensual'
  AND "type" = 'wholesale_prices';
