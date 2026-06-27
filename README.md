# TFG Backend — Plataforma de inteligencia analítica para almacenes

Backend de TFG sobre **Cloudflare Workers + Hono v4 + Drizzle ORM + Neon PostgreSQL + Better Auth**.

---

## Stack

- **Cloudflare Workers**
- **Hono**
- **Neon Postgres**
- **Drizzle ORM**
- **Better Auth**
- **Cloudflare Queues**
- **Cloudflare Cron Triggers**

## Setup local

### 1. Prerequisitos

- Node.js 20+ (recomendado usar [fnm](https://github.com/Schniz/fnm) o [nvm](https://github.com/Schniz/nvm))
- [pnpm](https://pnpm.io/) (`npm install -g pnpm`)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) (recomendado global: `npm install -g wrangler`)

### 2. Clonar e instalar

```bash
git clone https://github.com/JMRodriguez-work/tesis-backend.git
cd tesis-backend
pnpm install
```

### 3. Crear DB en Neon

> **Nota:** este repositorio ya tiene un archivo `.env` y `.dev.vars` con
> credenciales de una DB de Neon de desarrollo (proyecto `ep-tiny-fog-ai2i44y7`).
> Si vas a hacer una demo o probar el sistema, podés saltearte este paso y
> usar la DB que ya está configurada. Si querés tu propia DB:

1. Crear proyecto en [console.neon.tech](https://console.neon.tech/).
2. Copiar la **connection string** (con `?sslmode=require`).
3. Guardar tanto en `.env` (para drizzle-kit) como en `.dev.vars` (para wrangler dev).

### 4. Configurar variables de entorno

Hay **dos archivos** de configuración separados:

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

### 5. Aplicar migraciones a la DB

```bash
pnpm run db:migrate
```

### 6. (Opcional) Cargar datos de demo

```bash
pnpm run seed:demo
```

### 7. Arrancar el Worker

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

### 7. Test del cron en local (opcional)

Los Cron Triggers no corren automáticamente en `wrangler dev`. Para disparar el handler manualmente:

```bash
curl "http://localhost:8787/cdn-cgi/handler/scheduled?cron=0+6+*+*+*"
```
