import type { Request, Response } from "express";
import { usersService } from "@/modules/users/users.service";

export const usersController = {
  async getMe(req: Request, res: Response) {
    const profile = await usersService.getProfile(req.userId!);
    res.status(200).json(profile);
  },

  async deleteMe(req: Request, res: Response) {
    await usersService.deleteAccount(req.userId!);
    res.status(204).end();
  },

  async updateMe(req: Request, res: Response) {
    const profile = await usersService.updateProfile(req.userId!, req.body);
    res.status(200).json(profile);
  },
};
