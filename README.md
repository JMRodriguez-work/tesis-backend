# TFG Backend — Plataforma de inteligencia analítica para almacenes

Backend de TFG sobre **Cloudflare Workers + Hono v4 + Drizzle ORM + Neon PostgreSQL + Better Auth**.

> Fuente de verdad de la arquitectura, convenciones y decisiones del proyecto: ver [`AGENTS.md`](./AGENTS.md).
> Estado del proyecto, fases completadas y backlog: ver [`TODO.md`](./TODO.md).

---

## Stack

- **Runtime:** Cloudflare Workers (V8 isolate, no Node.js ni Bun)
- **HTTP framework:** [Hono v4](https://hono.dev/) + [`@hono/zod-openapi`](https://github.com/honojs/middleware/tree/main/packages/zod-openapi)
- **DB:** [Neon PostgreSQL serverless](https://neon.tech/) (HTTP via `drizzle-orm/neon-serverless` con WebSockets)
- **ORM:** [Drizzle ORM](https://orm.drizzle.team/)
- **Auth:** [Better Auth](https://www.better-auth.com/)
- **Validación:** [Zod](https://zod.dev/)
- **Async jobs:** Cloudflare Queues (producer + consumer en el mismo Worker)
- **Cron:** Cloudflare Cron Triggers
- **Deploy:** [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
- **Docs:** [Scalar](https://github.com/scalar/scalar) en `/docs` (OpenAPI 3.0)

---

## Estructura del proyecto

```
src/
├── index.ts                          # Entry point. Top-level wiring. SIN lógica de negocio.
├── modules/                          # Un directorio por feature/dominio
│   ├── <recurso>/
│   │   ├── domain/                   # Tipos e interfaces del dominio
│   │   ├── use-cases/                # 1 archivo por use case, kebab-case
│   │   ├── infra/
│   │   │   ├── http/                 # router + schemas Zod
│   │   │   └── repository/           # Acceso a DB con Drizzle
│   │   └── triggers/                 # (opcional) funciones cross-módulo
└── shared/
    ├── db/                           # createDb + schema Drizzle
    ├── auth/                         # Better Auth + authMiddleware
    ├── http/                         # middlewares, ApiResponse/ApiError, openapi
    ├── queue/                        # Cloudflare Queues (producer + consumer)
    ├── env/                          # tipos del Worker
    └── types/                        # tipos globales de Hono
```

Convención de nomenclatura: `kebab-case` para archivos, `PascalCase` para clases, `snake_case` plural para tablas Drizzle, `/api/v1/<recurso>` para rutas HTTP, `PascalCase` singular para tags OpenAPI.

Detalle completo en [`AGENTS.md`](./AGENTS.md).

---

## Setup local

### 1. Prerequisitos

- Node.js 20+ (recomendado usar [fnm](https://github.com/Schniz/fnm) o [nvm](https://github.com/nvm-sh/nvm))
- [pnpm](https://pnpm.io/) (`npm install -g pnpm`)
- Cuenta en [Neon](https://neon.tech/) (free tier OK)
- Cuenta en [Cloudflare](https://dash.cloudflare.com/) (free tier OK)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) (recomendado global: `npm install -g wrangler`)

### 2. Clonar e instalar

```bash
git clone <repo-url>
cd tesis-backend
pnpm install
```

### 3. Crear DB en Neon

1. Crear proyecto en [console.neon.tech](https://console.neon.tech/).
2. Copiar la **connection string** (con `?sslmode=require`).
3. Guardar tanto en `.env` (para drizzle-kit) como en `.dev.vars` (para wrangler dev).

### 4. Configurar variables de entorno

Hay **dos archivos** de configuración separados (ver [`AGENTS.md` §10](./AGENTS.md) para la rationale):

```bash
# Para tooling Node (drizzle-kit, drizzle-kit studio, tsx)
cp .env.example .env
# Editar .env y pegar DATABASE_URL

# Para wrangler dev (runtime del Worker)
cp .dev.vars.example .dev.vars
# Editar .dev.vars y pegar DATABASE_URL + BETTER_AUTH_SECRET
```

Generar `BETTER_AUTH_SECRET`:
```bash
openssl rand -base64 32
```

**Importante:** tanto `.env` como `.dev.vars` están en `.gitignore`. NO commitear valores reales.

### 5. Aplicar migraciones a la DB

```bash
pnpm run db:migrate
```

Esto corre todas las migraciones de `drizzle/` en orden. La primera vez aplica 0000-0011 (init, seeds, schema, etc.).

### 6. Arrancar el Worker

```bash
pnpm run dev
```

El servidor queda en `http://localhost:8787`.

Probar:
```bash
curl http://localhost:8787/health
# → {"status":"ok","timestamp":"..."}

curl http://localhost:8787/docs
# → UI de Scalar con todos los endpoints

curl http://localhost:8787/doc
# → OpenAPI 3.0 spec en JSON
```

### 7. Test del cron en local (opcional)

Los Cron Triggers no corren automáticamente en `wrangler dev`. Para disparar el handler manualmente:

```bash
curl "http://localhost:8787/cdn-cgi/handler/scheduled?cron=0+6+*+*+*"
```

---

## Scripts

| Script | Descripción |
|---|---|
| `pnpm run dev` | Levanta el Worker local con `wrangler dev` |
| `pnpm run deploy` | Deploy a Cloudflare Workers (`--minify`) |
| `pnpm run type-check` | `tsc --noEmit` |
| `pnpm run db:generate` | Genera migración cuando cambia `schema.ts` (autogenerada) |
| `pnpm run db:generate:custom` | Genera wrapper de migración custom (pegar SQL en `drizzle/` antes) |
| `pnpm run db:migrate` | Aplica migraciones pendientes a la DB de `DATABASE_URL` |

> **Regla de migraciones**: NUNCA crear el `.sql` a mano. Cambios de schema → modificar `schema.ts` + `pnpm run db:generate`. SQL custom → pegar en `drizzle/` + `pnpm run db:generate:custom`. Aplicar con `pnpm run db:migrate`.

---

## Tests

**El proyecto no usa tests automatizados** (mismo criterio desde Fase 0). Verificación por curl manual.

Suite de smoke tests recomendada después de cada cambio:

```bash
# 1. /health
curl http://localhost:8787/health

# 2. Sign-up
curl -X POST http://localhost:8787/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"email":"test@tesis.com","password":"Test1234!","name":"Test User"}'

# 3. Onboarding (con session cookie del sign-up)
curl -X POST http://localhost:8787/api/v1/onboarding \
  -H "Content-Type: application/json" \
  -c cookies.txt -b cookies.txt \
  -d '{"organizationName":"Mi Tienda","branchName":"Sucursal 1","warehouseName":"Depósito"}'

# 4. Crear item, venta, ver recomendaciones
# Ver TODO.md §4.1-4.3 para tests E2E completos
```

---

## Deploy a producción

> El deploy **no se ejecuta automáticamente** desde este repo. La intención es que vos corras los comandos de Wrangler manualmente cuando estés listo.

### Prerequisitos

- `wrangler` CLI instalado y logueado (`wrangler login`).
- DB de producción en Neon (separada de dev). Crear otro proyecto en Neon y obtener su `DATABASE_URL`.
- Confirmar que el `wrangler.jsonc` está actualizado. El archivo ya incluye un env `production` separado con queue `tfg-analytics-prod` (ver [`AGENTS.md` §10](./AGENTS.md)).

### 1. Setear secrets en Cloudflare

Wrangler **NO** lee `.env` ni `.dev.vars` para producción. Los secrets se setean vía CLI y se guardan cifrados en Cloudflare:

```bash
# DATABASE_URL de Neon producción
wrangler secret put DATABASE_URL --env production
# (pegar la connection string cuando lo pida)

# BETTER_AUTH_SECRET — debe ser DISTINTO al de dev
wrangler secret put BETTER_AUTH_SECRET --env production
# (pegar el secret generado con `openssl rand -base64 32`)
```

### 2. Crear las queues de producción (solo la primera vez)

Si es el primer deploy, las queues no existen aún. Wrangler las crea automáticamente desde `wrangler.jsonc` al deployar, pero también podés crearlas manualmente:

```bash
wrangler queues create tfg-analytics-prod
wrangler queues create tfg-analytics-prod-dlq
```

Para verificar:
```bash
wrangler queues list
```

### 3. Aplicar migraciones a la DB de producción

**Importante:** Neon prod es una DB distinta. `pnpm run db:migrate` apunta a `DATABASE_URL` de `.env` (que es la dev). Para prod:

```bash
# Temporalmente apuntar a prod
DATABASE_URL="postgresql://USER:PASS@HOST/DBNAME?sslmode=require" pnpm run db:migrate
```

(Si `pnpm` no propaga la var, exportarla antes: `export DATABASE_URL=... && pnpm run db:migrate`.)

### 4. Deploy

```bash
pnpm run deploy -- --env production
```

(El script `pnpm run deploy` por default deploya al env default. Para prod hay que pasar `--env production`.)

O directamente:
```bash
wrangler deploy --env production --minify
```

Wrangler va a:
- Bundlear el código
- Subirlo a Cloudflare
- Configurar las queues + bindings declarados en `wrangler.jsonc`
- Devolver la URL del Worker: `https://tfg-backend.<tu-subdominio>.workers.dev`

### 5. Verificación post-deploy

```bash
# Health
curl https://tfg-backend.<subdominio>.workers.dev/health
# → {"status":"ok","timestamp":"..."}

# Docs
open https://tfg-backend.<subdominio>.workers.dev/docs

# Smoke test sign-up
curl -X POST https://tfg-backend.<subdominio>.workers.dev/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"email":"prod-smoke@tesis.com","password":"Smoke1234!","name":"Smoke Test"}'
```

### 6. Configurar `BETTER_AUTH_URL` para prod

El `wrangler.jsonc` ya tiene `BETTER_AUTH_URL: "https://tfg-backend.<subdominio>.workers.dev"` en el env `production` (placeholder). **Reemplazar `<subdominio>` con tu subdominio real** antes del primer deploy, sino Better Auth va a generar cookies para `localhost:8787` y los redirects van a fallar.

---

## Variables de entorno

| Variable | Dónde se setea | Descripción |
|---|---|---|
| `DATABASE_URL` | `.env` (drizzle-kit) y `.dev.vars` (wrangler) | Connection string de Neon PostgreSQL. En prod: `wrangler secret put`. |
| `BETTER_AUTH_SECRET` | `.env` y `.dev.vars` | Secret de Better Auth para firmar tokens. En prod: `wrangler secret put`. Mismo valor en ambos archivos. |
| `BETTER_AUTH_URL` | `wrangler.jsonc` (var, no secret) | URL base del Worker. Default dev: `http://localhost:8787`. Prod: la URL de `workers.dev`. |

---

## Troubleshooting

### `wrangler dev` no arranca: "DATABASE_URL is not set"

Verificar que `.dev.vars` existe y tiene `DATABASE_URL=postgresql://...`.

### `pnpm run db:migrate` falla con "no se pudo conectar"

Verificar que `DATABASE_URL` en `.env` apunta a una DB Neon activa y que el password es correcto. Neon free tier "duerme" después de 5 min de inactividad — la primera query puede tardar 2-3s.

### `wrangler queues create` falla con "queue already exists"

Las queues son globales por cuenta de Cloudflare. Si ya existen, no las podés recrear. Listalas con `wrangler queues list`.

### `/docs` devuelve 404

Verificar que `setupOpenAPI(app)` está siendo llamado en `src/index.ts`. Si no, agregarlo (ver [`AGENTS.md` §8.3](./AGENTS.md)).

### Migración nueva genera "duplicate key value"

Probablemente hay datos en la DB que violan el nuevo constraint. Identificar con un SELECT antes de aplicar la migración.

---

## Arquitectura

Detalles en [`AGENTS.md`](./AGENTS.md):

- [§1 Contexto del proyecto](./AGENTS.md)
- [§2 Modelo mental: cómo funciona un Worker](./AGENTS.md)
- [§3 Estructura de directorios](./AGENTS.md)
- [§5 Tipos globales](./AGENTS.md)
- [§6 Base de datos — createDb, dbMiddleware y schema](./AGENTS.md)
- [§6.3 Cloudflare Queues + Cron Triggers](./AGENTS.md)
- [§7 Patrón de implementación por módulo](./AGENTS.md)
- [§8 Shared — piezas clave](./AGENTS.md)
- [§9 Entry point (triple export)](./AGENTS.md)
- [§10 Configuración Cloudflare](./AGENTS.md)

---

## Estado del proyecto

| Fase | HU cubiertas | Estado |
|------|-------------|--------|
| Fase 0 — Fundación | HU-001, HU-002, HU-003 | 71% (0.1 ✅, 0.2 parcial ✅, 0.3 parcial) |
| Fase 1 — Entidades maestras | HU-004, HU-005, HU-006, HU-007, HU-008, HU-015, HU-016, HU-020, HU-021, HU-022 | 100% ✅ |
| Fase 2 — Transacciones core | HU-009, HU-010, HU-011, HU-012, HU-013, HU-014, HU-017, HU-018, HU-019, HU-023, HU-024 | 100% ✅ |
| Fase 3 — Inteligencia analítica | HU-025, HU-026, HU-027, HU-028, HU-029, HU-030, HU-031, HU-032, HU-033, HU-034, HU-035 | 100% ✅ |
| Fase 4 — Pulido | 4.1 ✅, 4.2 ✅, 4.3 ✅, 4.4 ✅ | 100% ✅ |

Detalle en [`TODO.md`](./TODO.md).

---

## Licencia

Trabajo final de grado — uso académico.
