INSERT INTO "external_data_sources" ("name", "type", "url", "is_active", "auth_config")
VALUES (
  'INDEC IPC mensual',
  'wholesale_prices',
  'https://apis.datos.gob.ar/series/api/series/?ids=103.1_I2N_2016_M_19&format=json&start_date=2023-01-01&last=24',
  true,
  NULL
)
ON CONFLICT DO NOTHING;
