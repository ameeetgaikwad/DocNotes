import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { serve } from "@hono/node-server";
import { logger } from "./lib/logger.js";
import { trpcHandler } from "./middleware/trpc.js";
import type { Context, Next } from "hono";

const app = new Hono();
const PORT = Number(process.env.PORT) || 3001;

const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",")
  : ["http://localhost:3000"];

// Security headers
app.use(secureHeaders());

// CORS
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);

// Rate limiting (in-memory, per-IP)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 500;

app.use(async (c: Context, next: Next) => {
  const key =
    c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip") ?? "unknown";
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + WINDOW_MS });
  } else {
    entry.count++;
    if (entry.count > MAX_REQUESTS) {
      c.res = new Response("Too Many Requests", { status: 429 });
      return;
    }
  }

  await next();
});

// Request logging
app.use(async (c: Context, next: Next) => {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  logger.info(
    {
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      duration,
    },
    "request completed",
  );
});

// Health check
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Root endpoint
app.get("/", (c) => {
  return c.json({ message: "DocNotes API", version: "0.0.1" });
});

// tRPC API
app.use("/trpc/*", trpcHandler);

serve({ fetch: app.fetch, port: PORT }, () => {
  logger.info(`Server is running on port ${PORT}`);
});
