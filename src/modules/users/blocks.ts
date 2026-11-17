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
export const blockBodySchema = z.object({ label: z.string().trim().max(120).optional() });

export const blocksService = {
  async block(blockerId: string, blockedId: string, label?: string) {
    if (blockerId === blockedId) throw new BadRequestError("You can't block yourself");
    const target = await prisma.user.findUnique({ where: { id: blockedId }, select: { id: true } });
    if (!target) throw new NotFoundError("User not found");
    await prisma.userBlock.upsert({
      where: { blockerId_blockedId: { blockerId, blockedId } },
      create: { blockerId, blockedId, label: label || null },
      update: label ? { label } : {},
    });
  },

  async unblock(blockerId: string, blockedId: string) {
    await prisma.userBlock.deleteMany({ where: { blockerId, blockedId } });
  },

  /**
   * Community posts are anonymous, so this never returns the blocked
   * person's name or photo (blocking must not reveal who posted something);
   * only the label the blocker saw, like the post title.
   */
  async list(blockerId: string) {
    const rows = await prisma.userBlock.findMany({ where: { blockerId }, orderBy: { createdAt: "desc" } });
    return rows.map((r) => ({ userId: r.blockedId, label: r.label, blockedAt: r.createdAt }));
  },
};

export const blocksController = {
  async list(req: Request, res: Response) {
    res.status(200).json(await blocksService.list(req.userId!));
  },
  async block(req: Request, res: Response) {
    await blocksService.block(req.userId!, req.params.userId!, req.body?.label);
    res.status(200).json({ blocked: true });
  },
  async unblock(req: Request, res: Response) {
    await blocksService.unblock(req.userId!, req.params.userId!);
    res.status(200).json({ blocked: false });
  },
};
