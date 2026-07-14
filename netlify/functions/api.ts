import type { Handler, HandlerResponse } from "@netlify/functions";
import serverless from "serverless-http";
import { app, initializeServer } from "../../server/index.js";

const expressHandler = serverless(app);

export const handler: Handler = async (event, context) => {
  await initializeServer();
  const path = event.path.replace(/^\/\.netlify\/functions\/api/, "/api");
  return (await expressHandler({ ...event, path }, context)) as HandlerResponse;
};
