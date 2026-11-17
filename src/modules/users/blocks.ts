import type { Request, Response } from "express";
import { z } from "zod";
import { BadRequestError, NotFoundError } from "@/common/errors/app-error";
import { prisma } from "@/db/prisma.client";

/**
 * Blocking: the blocker no longer sees the blocked person's Community posts.
 * (Circles are invite-only with Admin approval, so blocking isn't needed
 * there; an Admin removes a member instead.)
 */
export const blockParamsSchema = z.object({ userId: z.string().uuid() });

export const blocksService = {
  async block(blockerId: string, blockedId: string) {
    if (blockerId === blockedId) throw new BadRequestError("You can't block yourself");
    const target = await prisma.user.findUnique({ where: { id: blockedId }, select: { id: true } });
    if (!target) throw new NotFoundError("User not found");
    await prisma.userBlock.upsert({
      where: { blockerId_blockedId: { blockerId, blockedId } },
      create: { blockerId, blockedId },
      update: {},
    });
  },

  async unblock(blockerId: string, blockedId: string) {
    await prisma.userBlock.deleteMany({ where: { blockerId, blockedId } });
  },

  /** Only what's needed to recognise them: Community posts are anonymous, so a name may be missing. */
  async list(blockerId: string) {
    const rows = await prisma.userBlock.findMany({
      where: { blockerId },
      include: { blocked: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => ({ userId: r.blocked.id, name: r.blocked.name, avatarUrl: r.blocked.avatarUrl, blockedAt: r.createdAt }));
  },
};

export const blocksController = {
  async list(req: Request, res: Response) {
    res.status(200).json(await blocksService.list(req.userId!));
  },
  async block(req: Request, res: Response) {
    await blocksService.block(req.userId!, req.params.userId!);
    res.status(200).json({ blocked: true });
  },
  async unblock(req: Request, res: Response) {
    await blocksService.unblock(req.userId!, req.params.userId!);
    res.status(200).json({ blocked: false });
  },
};
