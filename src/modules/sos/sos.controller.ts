import type { Request, Response } from "express";
import { sosService } from "@/modules/sos/sos.service";

export const sosController = {
  async trigger(req: Request, res: Response) {
    const event = await sosService.trigger(req.userId!, req.body.circleId);
    res.status(201).json(event);
  },

  async acknowledge(req: Request, res: Response) {
    const result = await sosService.acknowledge(req.params.sosEventId!, req.userId!);
    res.status(200).json(result);
  },

  async resolve(req: Request, res: Response) {
    const result = await sosService.resolve(req.params.sosEventId!, req.userId!);
    res.status(200).json(result);
  },

  async getLog(req: Request, res: Response) {
    const log = await sosService.getLog(req.params.sosEventId!, req.userId!);
    res.status(200).json(log);
  },

  async attachVideo(req: Request, res: Response) {
    const event = await sosService.attachVideo(req.params.sosEventId!, req.userId!, req.body.videoPath);
    res.status(200).json(event);
  },
};
