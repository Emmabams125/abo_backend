import type { Request, Response } from "express";
import { privacyCenterService } from "@/modules/privacy-center/privacy-center.service";

export const privacyCenterController = {
  async get(req: Request, res: Response) {
    const result = await privacyCenterService.getPrivacyCenter(req.params.circleId!, req.userId!);
    res.status(200).json(result);
  },
};
