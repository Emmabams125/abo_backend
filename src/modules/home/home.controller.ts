import type { Request, Response } from "express";
import { homeService } from "@/modules/home/home.service";

export const homeController = {
  async getDashboard(req: Request, res: Response) {
    const dashboard = await homeService.getDashboard(req.params.circleId!, req.userId!);
    res.status(200).json(dashboard);
  },
};
