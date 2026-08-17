import type { Request, Response } from "express";
import { locationService } from "@/modules/location/location.service";

export const locationController = {
  async ping(req: Request, res: Response) {
    const { lat, lng, accuracy, batteryPct } = req.body;
    await locationService.recordPing(req.userId!, lat, lng, accuracy, batteryPct);
    res.status(202).json({ message: "Location recorded" });
  },

  async getMemberLocation(req: Request, res: Response) {
    const { circleId, userId } = req.params as { circleId: string; userId: string };
    const location = await locationService.getLatestLocation(userId, req.userId!, circleId);
    res.status(200).json(location);
  },

  async getMemberHistory(req: Request, res: Response) {
    const { circleId, userId } = req.params as { circleId: string; userId: string };
    const history = await locationService.getLocationHistory(userId, req.userId!, circleId);
    res.status(200).json(history);
  },

  async updateRetention(req: Request, res: Response) {
    const setting = await locationService.updateRetentionSetting(
      req.params.circleId!,
      req.userId!,
      req.body.retentionDays
    );
    res.status(200).json(setting);
  },

  async createSafePlace(req: Request, res: Response) {
    const { name, lat, lng, radiusM } = req.body;
    const safePlace = await locationService.createSafePlace(
      req.params.circleId!,
      req.userId!,
      name,
      lat,
      lng,
      radiusM
    );
    res.status(201).json(safePlace);
  },

  async listSafePlaces(req: Request, res: Response) {
    const safePlaces = await locationService.listSafePlaces(req.params.circleId!, req.userId!);
    res.status(200).json(safePlaces);
  },

  async deleteSafePlace(req: Request, res: Response) {
    await locationService.deleteSafePlace(req.params.circleId!, req.params.safePlaceId!, req.userId!);
    res.status(204).send();
  },
};
