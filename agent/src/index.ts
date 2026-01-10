import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import chat from "./routes/chat";

const app = new Hono();

// Middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: ["http://localhost:3000"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

// Health check
app.get("/", (c) => {
  return c.json({
    name: "WD Logistics AI Agent",
    version: "1.0.0",
    status: "healthy",
    endpoints: {
      chat: "/chat",
      chatStream: "/chat/stream",
      chatHealth: "/chat/health",
    },
  });
});

// Mount chat routes
app.route("/chat", chat);

// Start server
const port = Number(process.env.PORT) || 3001;

console.log(`🤖 WD Logistics AI Agent running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});

export default app;
