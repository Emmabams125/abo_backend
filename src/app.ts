import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";
import swaggerUi from "swagger-ui-express";
import { errorHandler, notFoundHandler } from "@/common/middleware/error-handler";
import { openApiSpec } from "@/docs/openapi";
import { logger } from "@/common/utils/logger";
import { legalRouter } from "@/modules/legal/legal.routes";
import { authRouter } from "@/modules/auth/auth.routes";
import { circlesRouter } from "@/modules/circles/circles.routes";
import { communityRouter } from "@/modules/community/community.routes";
import { devicesRouter } from "@/modules/devices/devices.routes";
import { homeRouter } from "@/modules/home/home.routes";
import { locationRouter } from "@/modules/location/location.routes";
import { mediaRouter } from "@/modules/media/media.routes";
import { messagesRouter } from "@/modules/messages/messages.routes";
import { privacyCenterRouter } from "@/modules/privacy-center/privacy-center.routes";
import { reassuranceRouter } from "@/modules/reassurance/reassurance.routes";
import { sosRouter } from "@/modules/sos/sos.routes";
import { subscriptionRouter } from "@/modules/subscription/subscription.routes";
import { usersRouter } from "@/modules/users/users.routes";

export function createApp() {
  const app = express();

  // Nginx sits in front of the API (deploy/nginx-abo.conf) and sets
  // X-Forwarded-For. Trust exactly that one hop so req.ip is the client's
  // address; otherwise every request looks like 127.0.0.1 and the rate
  // limiters lump all users into one bucket.
  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(pinoHttp({ logger }));

  app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));

  // Swagger UI needs inline scripts/styles that the default CSP blocks —
  // scoped to just this path so the rest of the API keeps helmet's defaults.
  app.use(
    "/docs",
    (_req: Request, res: Response, next: NextFunction) => {
      res.removeHeader("Content-Security-Policy");
      next();
    },
    swaggerUi.serve,
    swaggerUi.setup(openApiSpec)
  );

  // Public privacy policy + account deletion pages (Google Play listing).
  app.use(legalRouter);
  app.use("/auth", authRouter);
  app.use("/circles", circlesRouter);
  app.use("/community", communityRouter);
  app.use("/users", usersRouter);
  app.use("/devices", devicesRouter);
  app.use("/home", homeRouter);
  app.use("/location", locationRouter);
  app.use("/media", mediaRouter);
  app.use("/sos", sosRouter);
  app.use("/reassurance", reassuranceRouter);
  app.use("/messages", messagesRouter);
  app.use("/privacy-center", privacyCenterRouter);
  app.use("/subscription", subscriptionRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
