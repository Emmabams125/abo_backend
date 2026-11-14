import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { verifyAccessToken } from "@/common/utils/jwt";
import { createRedisConnection } from "@/config/redis";
import { logger } from "@/common/utils/logger";
import { prisma } from "@/db/prisma.client";

let io: Server | undefined;

export function initSocketServer(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: "*" },
  });

  const pubClient = createRedisConnection();
  const subClient = pubClient.duplicate();
  io.adapter(createAdapter(pubClient, subClient));

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) throw new Error("Missing auth token");
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.userId;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const userId = socket.data.userId as string;
    logger.debug({ userId, socketId: socket.id }, "socket connected");
    // Personal room: reaches this user even before they're an ACTIVE member
    // of any Circle (e.g. "your join request was approved").
    void socket.join(userRoom(userId));

    socket.on("circle:join", async (circleId: string, ack?: (ok: boolean) => void) => {
      const membership = await prisma.circleMembership.findUnique({
        where: { userId_circleId: { userId, circleId } },
      });
      if (!membership || membership.status !== "ACTIVE") {
        ack?.(false);
        return;
      }
      await socket.join(circleRoom(circleId));
      ack?.(true);
    });

    socket.on("circle:leave", (circleId: string) => {
      socket.leave(circleRoom(circleId));
    });
  });

  return io;
}

export function circleRoom(circleId: string): string {
  return `circle:${circleId}`;
}

export function userRoom(userId: string): string {
  return `user:${userId}`;
}

export function emitToUser(userId: string, event: string, payload: unknown): void {
  if (!io) {
    logger.warn({ userId, event }, "Socket.io not initialized — dropping realtime event");
    return;
  }
  io.to(userRoom(userId)).emit(event, payload);
}

export function emitToCircle(circleId: string, event: string, payload: unknown): void {
  if (!io) {
    logger.warn({ circleId, event }, "Socket.io not initialized — dropping realtime event");
    return;
  }
  io.to(circleRoom(circleId)).emit(event, payload);
}
