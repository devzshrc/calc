import { app } from "./app";
import { connect } from "./db";
import { startWorker } from "./worker";

await connect();
startWorker();
export type { AppType } from "./app";
export default { port: Number(process.env.PORT ?? 3001), fetch: app.fetch };
