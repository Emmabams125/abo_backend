import type { Request, Response } from "express";
import { authService } from "@/modules/auth/auth.service";

export const authController = {
  async requestOtp(req: Request, res: Response) {
    await authService.requestOtp(req.body.phone);
    res.status(202).json({ message: "OTP sent" });
  },

  async verifyOtp(req: Request, res: Response) {
    const { phone, code, deviceId } = req.body;
    const result = await authService.verifyOtpAndAuthenticate(phone, code, deviceId);
    res.status(200).json(result);
  },

  async refresh(req: Request, res: Response) {
    const result = await authService.refresh(req.body.refreshToken);
    res.status(200).json(result);
  },

  async logout(req: Request, res: Response) {
    await authService.logout(req.body.refreshToken);
    res.status(204).send();
  },

  async requestReauthOtp(req: Request, res: Response) {
    await authService.requestReauthOtp(req.body.phone);
    res.status(202).json({ message: "OTP sent" });
  },

  async verifyReauth(req: Request, res: Response) {
    const { phone, code } = req.body;
    const reauthToken = await authService.verifyReauth(phone, code, req.userId!);
    res.status(200).json({ reauthToken });
  },
};
