import { createServer } from "node:http";
import { createApp } from "@/app";
import { env } from "@/config/env";
import { logger } from "@/common/utils/logger";
import { initSocketServer } from "@/realtime/socket.server";

const app = createApp();
const httpServer = createServer(app);
initSocketServer(httpServer);

httpServer.listen(env.PORT, () => {
  logger.info(`Abo backend listening on port ${env.PORT}`);
});
0