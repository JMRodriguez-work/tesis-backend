-- Roles
INSERT INTO "roles" ("name", "created_at", "updated_at") VALUES
  ('Admin',    NOW(), NOW()),
  ('Manager',  NOW(), NOW()),
  ('Employee', NOW(), NOW());

-- Unidades base
INSERT INTO "units" ("name", "abbreviation", "unit_type", "conversion_factor", "created_at") VALUES
  ('Unidad',    'un',  'count',  1,     NOW()),
  ('Kilogramo', 'kg',  'weight', 1,     NOW()),
  ('Gramo',     'g',   'weight', 0.001, NOW()),
  ('Litro',     'l',   'volume', 1,     NOW()),
  ('Mililitro', 'ml',  'volume', 0.001, NOW()),
  ('Docena',    'doc', 'count',  12,    NOW()),
  ('Caja',      'cja', 'count',  1,     NOW());
