
import { neon, neonConfig } from "@neondatabase/serverless";
import { config as loadEnv } from "dotenv";
import * as ws from "ws";


neonConfig.webSocketConstructor = ws as unknown as typeof globalThis.WebSocket;

loadEnv({ path: ".env" });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL no está definida en .env");
}

const API_URL = process.env.SEED_API_URL ?? "http://localhost:8787";

const sql = neon(DATABASE_URL);

const ORG_NAME = "Almacén Don Pedro";
const BRANCH_NAME = "Casa Central";
const WAREHOUSE_NAME = "Depósito Principal";
const ADMIN_NAME = "Pedro Demo";
const ADMIN_EMAIL = "admin@demo.com";
const ADMIN_PASSWORD = "12345678";



function daysAgoIso(days: number, hour = 12) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
}

function fmt(n: number, decimals = 2) {
  return n.toFixed(decimals);
}

function logHeader(title: string) {
  console.log(`\n${"─".repeat(60)}\n  ${title}\n${"─".repeat(60)}`);
}


async function ensureAdminUserId(): Promise<string> {
  const body = JSON.stringify({
    name: ADMIN_NAME,
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });

  const signUpRes = await fetch(`${API_URL}/api/auth/sign-up/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: API_URL,
    },
    body,
  });

  if (signUpRes.ok) {
    const data = (await signUpRes.json()) as { user: { id: string } };
    return data.user.id;
  }

  const signInRes = await fetch(`${API_URL}/api/auth/sign-in/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: API_URL,
    },
    body,
  });

  if (!signInRes.ok) {
    const text = await signInRes.text();
    throw new Error(
      `No se pudo crear ni autenticar al usuario admin.\n` +
        `  sign-up: ${signUpRes.status}\n` +
        `  sign-in: ${signInRes.status} ${text}\n` +
        `  ¿El backend está corriendo en ${API_URL}?`,
    );
  }

  const data = (await signInRes.json()) as { user: { id: string } };
  return data.user.id;
}


async function main() {
  console.log("🌱 Seed demo TFG — Almacén Don Pedro");

  const existing = await sql`
		SELECT id FROM organizations WHERE name = ${ORG_NAME} AND deleted_at IS NULL LIMIT 1
	`;
  if (existing.length > 0) {
    console.log(
      `\n⚠️  La organización "${ORG_NAME}" ya existe (id=${existing[0].id}).`,
    );
    console.log(
      "    Si querés re-poblar desde cero, borrala primero en /settings/organization",
    );
    console.log(
      "    o directamente corré: DROP SCHEMA public CASCADE; CREATE SCHEMA public;",
    );
    console.log("    y luego: pnpm run db:migrate && pnpm run seed:demo\n");
    process.exit(0);
  }

  logHeader("0/11 · Cuenta admin (Better Auth)");
  console.log(`  → Verificando que el backend esté en ${API_URL}…`);
  try {
    const healthRes = await fetch(`${API_URL}/health`);
    if (!healthRes.ok) throw new Error(`status ${healthRes.status}`);
  } catch (err) {
    throw new Error(
      `No se pudo conectar con el backend en ${API_URL}/health.\n` +
        `  Asegurate de tener el back corriendo en otra terminal:\n` +
        `    cd tesis-backend && pnpm run dev\n` +
        `  Error original: ${err instanceof Error ? err.message : err}`,
    );
  }

  let adminUserId: string;
  try {
    adminUserId = await ensureAdminUserId();
    console.log(`  ✓ Cuenta admin lista → ${adminUserId}`);
  } catch (err) {
    throw new Error(
      `Falló la creación de la cuenta admin vía Better Auth.\n` +
        `  ${err instanceof Error ? err.message : err}`,
    );
  }

  logHeader("1/11 · Organización, sucursal y depósito");
  const orgRows = await sql`
		INSERT INTO organizations (name) VALUES (${ORG_NAME}) RETURNING id
	`;
  const orgId = orgRows[0].id as string;
  console.log(`  ✓ Organización "${ORG_NAME}" → ${orgId}`);

  const branchRows = await sql`
		INSERT INTO branches (organization_id, name) VALUES (${orgId}, ${BRANCH_NAME}) RETURNING id
	`;
  const branchId = branchRows[0].id as string;
  console.log(`  ✓ Sucursal "${BRANCH_NAME}" → ${branchId}`);

  const warehouseRows = await sql`
		INSERT INTO warehouses (organization_id, name, description)
		VALUES (${orgId}, ${WAREHOUSE_NAME}, ${"Depósito de la sucursal central"})
		RETURNING id
	`;
  const warehouseId = warehouseRows[0].id as string;
  console.log(`  ✓ Depósito "${WAREHOUSE_NAME}" → ${warehouseId}`);

  await sql`
		INSERT INTO warehouse_branches (warehouse_id, branch_id) VALUES (${warehouseId}, ${branchId})
	`;
  console.log("  ✓ Relación warehouse ↔ branch");


  await sql`
		UPDATE "user"
		SET organization_id = ${orgId},
		    branch_id = ${branchId},
		    role_id = 1,
		    updated_at = NOW()
		WHERE id = ${adminUserId}
	`;
  console.log("  ✓ User admin asociado a la organización (Admin role)");

  logHeader("2/11 · Categorías");
  const catAlmacen = await sql`
		INSERT INTO item_categories (branch_id, name, description)
		VALUES (${branchId}, ${"Almacén"}, ${"Artículos de almacén no perecederos"})
		RETURNING id
	`;
  const catBebidas = await sql`
		INSERT INTO item_categories (branch_id, name, description)
		VALUES (${branchId}, ${"Bebidas"}, ${"Gaseosas, aguas y jugos"})
		RETURNING id
	`;
  const categoryAlmacenId = catAlmacen[0].id as string;
  const categoryBebidasId = catBebidas[0].id as string;
  console.log(`  ✓ Almacén → ${categoryAlmacenId}`);
  console.log(`  ✓ Bebidas → ${categoryBebidasId}`);

  logHeader("3/11 · Productos");
  type ItemSeed = {
    name: string;
    categoryId: string;
    barcode: string;
    purchase: number;
    sale: number;
    minStock: number;
    stock: number;
  };
  const itemsToInsert: ItemSeed[] = [
    {
      name: "Coca-Cola 1.5L",
      categoryId: categoryBebidasId,
      barcode: "7910000001",
      purchase: 1000,
      sale: 1500,
      minStock: 10,
      stock: 30,
    },
    {
      name: "Sprite 1.5L",
      categoryId: categoryBebidasId,
      barcode: "7910000002",
      purchase: 950,
      sale: 1400,
      minStock: 8,
      stock: 24,
    },
    {
      name: "Agua Mineral 1.5L",
      categoryId: categoryBebidasId,
      barcode: "7910000007",
      purchase: 400,
      sale: 700,
      minStock: 20,
      stock: 48,
    },
    {
      name: "Arroz 1kg",
      categoryId: categoryAlmacenId,
      barcode: "7910000003",
      purchase: 800,
      sale: 1200,
      minStock: 15,
      stock: 30,
    },
    {
      name: "Fideos 500g",
      categoryId: categoryAlmacenId,
      barcode: "7910000004",
      purchase: 600,
      sale: 900,
      minStock: 20,
      stock: 45,
    },
    {
      name: "Aceite Girasol 1.5L",
      categoryId: categoryAlmacenId,
      barcode: "7910000005",
      purchase: 2500,
      sale: 3500,
      minStock: 5,
      stock: 18,
    },
  ];

  const itemIds: Record<string, string> = {};
  for (const it of itemsToInsert) {
    const rows = await sql`
			INSERT INTO items (
				branch_id, category_id, name, barcode, code,
				purchase_price, sale_price, is_active
			) VALUES (
				${branchId}, ${it.categoryId}, ${it.name}, ${it.barcode}, ${it.barcode},
				${fmt(it.purchase)}, ${fmt(it.sale)}, true
			)
			RETURNING id
		`;
    const id = rows[0].id as string;
    itemIds[it.name] = id;
    console.log(
      `  ✓ ${it.name.padEnd(22)} $${fmt(it.sale, 0)} · stock ${it.stock} · min ${it.minStock}`,
    );
  }

  logHeader("4/11 · Stock inicial + movimientos de auditoría");

  for (const it of itemsToInsert) {
    const itemId = itemIds[it.name];
    await sql`
			INSERT INTO warehouse_item_stocks (item_id, warehouse_id, quantity, min_stock)
			VALUES (${itemId}, ${warehouseId}, ${fmt(it.stock, 3)}, ${fmt(it.minStock, 3)})
		`;
    await sql`
			INSERT INTO stock_movements (
				branch_id, item_id, to_warehouse_id, created_by, type,
				quantity, reference_type, notes
			) VALUES (
				${branchId}, ${itemId}, ${warehouseId}, ${adminUserId}, 'in',
				${fmt(it.stock, 3)}, 'manual', 'Stock inicial'
			)
		`;
  }
  console.log(`  ✓ Stock cargado para ${itemsToInsert.length} productos`);

  logHeader("5/11 · Clientes");
  const c1 = await sql`
		INSERT INTO customers (organization_id, branch_id, fullname, email, phone)
		VALUES (${orgId}, ${branchId}, ${"Juan Pérez"}, ${"juan.perez@example.com"}, ${"+5491144556677"})
		RETURNING id
	`;
  const c2 = await sql`
		INSERT INTO customers (organization_id, branch_id, fullname, email, phone)
		VALUES (${orgId}, ${branchId}, ${"María González"}, ${"maria.g@example.com"}, ${"+5491144556688"})
		RETURNING id
	`;
  const c3 = await sql`
		INSERT INTO customers (organization_id, branch_id, fullname, email, phone)
		VALUES (${orgId}, ${branchId}, ${"Carlos López"}, ${"carlos.l@example.com"}, ${"+5491144556699"})
		RETURNING id
	`;
  const customerId1 = c1[0].id as string;
  const customerId2 = c2[0].id as string;
  const customerId3 = c3[0].id as string;
  console.log(`  ✓ Juan Pérez (frecuente)      → ${customerId1}`);
  console.log(`  ✓ María González (nuevo)      → ${customerId2}`);
  console.log(`  ✓ Carlos López (INACTIVO 75d) → ${customerId3}`);

  logHeader("6/11 · Proveedor");
  const providerRow = await sql`
		INSERT INTO providers (
			organization_id, name, company_name, contact_name, contact_email, contact_phone
		) VALUES (
			${orgId},
			${"Distribuidora del Sur"},
			${"Distribuidora del Sur SRL"},
			${"Roberto Méndez"},
			${"ventas@distrisur.com.ar"},
			${"+5491145678901"}
		)
		RETURNING id
	`;
  const providerId = providerRow[0].id as string;
  console.log(`  ✓ Distribuidora del Sur → ${providerId}`);

  logHeader("7/11 · Orden a proveedor pendiente");
  const orderRow = await sql`
		INSERT INTO provider_orders (
			branch_id, provider_id, created_by, total, status, estimated_delivery
		) VALUES (
			${branchId}, ${providerId}, ${adminUserId},
			${fmt(50 * 1000 + 30 * 600, 2)},
			'pending',
			${daysAgoIso(-3, 10)}
		)
		RETURNING id
	`;
  const orderId = orderRow[0].id as string;
  await sql`
		INSERT INTO provider_order_items (order_id, item_id, quantity, cost)
		VALUES
			(${orderId}, ${itemIds["Coca-Cola 1.5L"]}, 50, ${fmt(1000, 2)}),
			(${orderId}, ${itemIds["Fideos 500g"]}, 30, ${fmt(600, 2)})
	`;
  console.log(`  ✓ Orden ${orderId.slice(0, 8)}… (50 Coca-Cola + 30 Fideos)`);

  logHeader("8/11 · Ventas históricas (8 ventas en 30 días)");

  type SaleSeed = {
    daysAgo: number;
    hour: number;
    items: { name: string; qty: number }[];
    customerId: string | null;
    discountPercent?: number;
    note?: string;
  };
  const salesToInsert: SaleSeed[] = [
    {
      daysAgo: 22,
      hour: 11,
      items: [
        { name: "Arroz 1kg", qty: 2 },
        { name: "Fideos 500g", qty: 3 },
      ],
      customerId: customerId1,
    },
    {
      daysAgo: 20,
      hour: 17,
      items: [{ name: "Coca-Cola 1.5L", qty: 4 }],
      customerId: null,
    },
    {
      daysAgo: 15,
      hour: 10,
      items: [
        { name: "Aceite Girasol 1.5L", qty: 1 },
        { name: "Arroz 1kg", qty: 2 },
      ],
      customerId: customerId1,
    },
    {
      daysAgo: 5,
      hour: 9,
      items: [
        { name: "Coca-Cola 1.5L", qty: 3 },
        { name: "Sprite 1.5L", qty: 2 },
      ],
      customerId: null,
    },
    {
      daysAgo: 4,
      hour: 18,
      items: [{ name: "Agua Mineral 1.5L", qty: 6 }],
      customerId: customerId2,
    },
    {
      daysAgo: 0,
      hour: 10,
      items: [
        { name: "Fideos 500g", qty: 2 },
        { name: "Aceite Girasol 1.5L", qty: 1 },
      ],
      customerId: customerId1,
    },
    {
      daysAgo: 0,
      hour: 11,
      items: [
        { name: "Coca-Cola 1.5L", qty: 5 },
        { name: "Fideos 500g", qty: 4 },
      ],
      customerId: customerId2,
      discountPercent: 10,
      note: "Cliente habitual",
    },

    {
      daysAgo: 0,
      hour: 12,
      items: [
        { name: "Coca-Cola 1.5L", qty: 9 },
        { name: "Sprite 1.5L", qty: 1 },
      ],
      customerId: null,
    },
  ];

  const cocaId = itemIds["Coca-Cola 1.5L"]!;
  const spriteId = itemIds["Sprite 1.5L"]!;
  let salesCreated = 0;

  for (const s of salesToInsert) {
    let subtotal = 0;
    for (const it of s.items) {
      const seed = itemsToInsert.find((x) => x.name === it.name);
      if (!seed) throw new Error(`Item no encontrado en seed: ${it.name}`);
      subtotal += seed.sale * it.qty;
    }
    const discount = s.discountPercent ?? 0;
    const total = subtotal * (1 - discount / 100);

    const saleRow = await sql`
			INSERT INTO sales (
				branch_id, customer_id, created_by, total, discount_percent, notes
			) VALUES (
				${branchId}, ${s.customerId}, ${adminUserId}, ${fmt(total, 2)},
				${fmt(discount, 2)}, ${s.note ?? null}
			)
			RETURNING id
		`;
    const saleId = saleRow[0].id as string;
    const createdAt = daysAgoIso(s.daysAgo, s.hour);

    await sql`UPDATE sales SET created_at = ${createdAt} WHERE id = ${saleId}`;

    for (const it of s.items) {
      const itemId = itemIds[it.name]!;
      const seed = itemsToInsert.find((x) => x.name === it.name)!;

      await sql`
				INSERT INTO sale_items (sale_id, item_id, quantity, price)
				VALUES (${saleId}, ${itemId}, ${fmt(it.qty, 3)}, ${fmt(seed.sale, 2)})
			`;
      await sql`
				UPDATE warehouse_item_stocks
				SET quantity = (quantity - ${fmt(it.qty, 3)}::numeric)::numeric(15, 3),
				    updated_at = NOW()
				WHERE item_id = ${itemId}::uuid AND warehouse_id = ${warehouseId}::uuid
			`;
      await sql`
				INSERT INTO stock_movements (
					branch_id, item_id, from_warehouse_id, created_by, type,
					quantity, reference_id, reference_type, created_at
				) VALUES (
					${branchId}, ${itemId}, ${warehouseId}, ${adminUserId}, 'out',
					${fmt(it.qty, 3)}, ${saleId}, 'sale', ${createdAt}
				)
			`;
    }

    salesCreated++;
    const tag = s.discountPercent ? ` (-${s.discountPercent}%)` : "";
    console.log(
      `  ✓ Venta ${salesCreated} · hace ${s.daysAgo}d · ${s.items.length} items${tag} · $${fmt(total, 0)}`,
    );
  }

  await sql`UPDATE sales SET created_at = ${daysAgoIso(0, 12)} WHERE id = (SELECT id FROM sales WHERE branch_id = ${branchId} ORDER BY created_at DESC LIMIT 1)`;
  console.log(`  → ${salesCreated} ventas insertadas con stock movements`);


  logHeader("9/11 · Recommendations manuales (restock + retention)");
  console.log("  → Coca-Cola: NO se precrea. Se generará en vivo al venderla.");
  await sql`
		INSERT INTO recommendations (
			branch_id, item_id, type, description, priority, status
		) VALUES (
			${branchId}, ${spriteId}, 'restock',
			${"Alta rotación detectada: Sprite 1.5L vendió 4 unidades en los últimos 5 días. Sugerimos reponer 30 unidades para evitar quiebre."},
			'medium', 'pending'
		)
	`;
  await sql`
		INSERT INTO recommendations (
			branch_id, customer_id, type, description, priority, status
		) VALUES (
			${branchId}, ${customerId3}, 'retention',
			${"Carlos López no compra hace 75 días (umbral: 60). Cliente frecuente en riesgo de abandono. Ofrecer promoción personalizada."},
			'high', 'pending'
		)
	`;
  console.log("  ✓ 1× recommendation 'restock' (Sprite, medium)");
  console.log("  ✓ 1× recommendation 'retention' (Carlos López, high)");


  logHeader("10/11 · Ventas antiguas de Carlos López (para HU-025)");
  for (const daysAgo of [90, 80]) {
    const c3SaleRow = await sql`
			INSERT INTO sales (
				branch_id, customer_id, created_by, total, discount_percent, created_at
			) VALUES (
				${branchId}, ${customerId3}, ${adminUserId}, ${fmt(4200, 2)},
				${fmt(0, 2)}, ${daysAgoIso(daysAgo, 14)}
			)
			RETURNING id
		`;
    const c3SaleId = c3SaleRow[0].id as string;
    await sql`
			INSERT INTO sale_items (sale_id, item_id, quantity, price)
			VALUES (${c3SaleId}, ${cocaId}, 2, ${fmt(1500, 2)})
		`;
    await sql`
			UPDATE warehouse_item_stocks
			SET quantity = (quantity - 2::numeric)::numeric(15, 3)
			WHERE item_id = ${cocaId}::uuid AND warehouse_id = ${warehouseId}::uuid
		`;
  }
  console.log("  ✓ 2 ventas antiguas para Carlos López (80d, 90d)");

  logHeader("11/11 · Source INDEC IPC");
  const existingIndec = await sql`
		SELECT id FROM external_data_sources WHERE name = 'INDEC IPC mensual' LIMIT 1
	`;
  if (existingIndec.length === 0) {
    await sql`
			INSERT INTO external_data_sources (name, type, url, is_active)
			VALUES (
				'INDEC IPC mensual', 'wholesale_prices',
				${"https://apis.datos.gob.ar/series/api/series/?ids=103.1_I2N_2016_M_19&format=json&start_date=2023-01-01&last=24"},
				true
			)
		`;
    console.log("  ✓ Source INDEC creada");
  } else {
    console.log("  → Source INDEC ya existía (migración 0008)");
  }

  const existingSeasonality = await sql`
		SELECT id FROM external_data_sources WHERE name = 'Calendario estacional' LIMIT 1
	`;
  if (existingSeasonality.length === 0) {
    await sql`
			INSERT INTO external_data_sources (name, type, url, is_active)
			VALUES ('Calendario estacional', 'seasonality', NULL, true)
		`;
    console.log("Source estacionalidad creada (usa calendario por defecto, sin URL)");
  } else {
    console.log("  → Source estacionalidad ya existía");
  }


  console.log("\n");
  console.log("━".repeat(60));
  console.log("  ✅ Seed completado");
  console.log("━".repeat(60));
  console.log("\n  Ya podés iniciar el frontend (si no lo levantaste):");
  console.log("      cd tesis-frontend && pnpm run dev");
  console.log("\n  Y loguearte en http://localhost:5173/login:");
  console.log(`      email:    ${ADMIN_EMAIL}`);
  console.log(`      password: ${ADMIN_PASSWORD}`);
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Seed falló:", err);
    process.exit(1);
  });

export {};
