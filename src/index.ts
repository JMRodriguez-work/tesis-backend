import { Hono } from "hono";
import type { Env } from "./shared/env";

const app = new Hono<{ Bindings: Env }>();

app.get("/health", (c) =>
  c.json({ status: "ok", timestamp: new Date().toISOString() }),
);

export default app;
