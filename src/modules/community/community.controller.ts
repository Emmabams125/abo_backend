import type { CommunityAlertKind } from "@prisma/client";
import type { Request, Response } from "express";
import { communityService } from "@/modules/community/community.service";

export const communityController = {
  async createAlert(req: Request, res: Response) {
    const alert = await communityService.createAlert(req.userId!, req.body);
    res.status(201).json(alert);
  },

  async listNearby(req: Request, res: Response) {
    const query = req.query as unknown as {
      lat: number;
      lng: number;
      radiusM: number;
      kind?: CommunityAlertKind;
    };
    const alerts = await communityService.listNearby(query);
    res.status(200).json(alerts);
  },

  async resolveAlert(req: Request, res: Response) {
    const alert = await communityService.resolveAlert(req.params.alertId!, req.userId!);
    res.status(200).json(alert);
  },
};
