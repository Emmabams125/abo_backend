import type { Request, Response } from "express";
import { mediaService } from "@/modules/media/media.service";

export const mediaController = {
  async requestUploadUrl(req: Request, res: Response) {
    const { purpose, contentType } = req.body;
    const result = await mediaService.requestUploadUrl(req.userId!, purpose, contentType);
    res.status(200).json(result);
  },
};
