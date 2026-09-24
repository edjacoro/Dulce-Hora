import type { Handler, HandlerResponse } from "@netlify/functions";
import serverless from "serverless-http";

process.env.DULCE_HORA_SERVERLESS = "true";
process.env.NETLIFY = process.env.NETLIFY ?? "true";

let expressHandler: ReturnType<typeof serverless> | null = null;
let initializeServer: (() => Promise<void>) | null = null;

async function loadServer() {
  if (expressHandler && initializeServer) {
    return { expressHandler, initializeServer };
  }

  const server = await import("../../server/index.js");
  expressHandler = serverless(server.app);
  initializeServer = server.initializeServer;
  return { expressHandler, initializeServer };
}

export const handler: Handler = async (event, context) => {
  try {
    const server = await loadServer();
    await server.initializeServer();
    const path = event.path.replace(/^\/\.netlify\/functions\/api/, "/api");
    return (await server.expressHandler({ ...event, path }, context)) as HandlerResponse;
  } catch (error) {
    console.error("[netlify:function:api]", error);
    return {
      statusCode: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        error: "No se pudo iniciar el backend serverless",
        message: error instanceof Error ? error.message : "Error desconocido",
        environment: {
          databaseUrlConfigured: Boolean(process.env.DATABASE_URL),
          dulceHoraUsernameConfigured: Boolean(process.env.DULCE_HORA_USERNAME),
          dulceHoraPasswordConfigured: Boolean(process.env.DULCE_HORA_PASSWORD),
          serverless: process.env.DULCE_HORA_SERVERLESS === "true"
        }
      })
    };
  }
};
