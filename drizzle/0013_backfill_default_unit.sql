-- Convención del sistema: todo producto es contable por defecto ("Unidad").
-- Los items creados antes de esta convención quedaron con base_unit_id NULL,
-- lo que hacía que las sugerencias de reposición calculen demanda con
-- decimales ("comprar 10,25 unidades"). Se asigna la unidad base "Unidad"
-- a todos los items sin unidad. Idempotente: solo matchea base_unit_id NULL.
UPDATE items
SET base_unit_id = (SELECT id FROM units WHERE name = 'Unidad' LIMIT 1)
WHERE base_unit_id IS NULL;
