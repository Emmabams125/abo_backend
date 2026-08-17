import type { Request, Response } from "express";
import { reassuranceService } from "@/modules/reassurance/reassurance.service";

export const reassuranceController = {
  async checkIn(req: Request, res: Response) {
    const checkIn = await reassuranceService.checkIn(req.userId!, req.body.circleId);
    res.status(201).json(checkIn);
  },

  async getHistory(req: Request, res: Response) {
    const history = await reassuranceService.getCircleHistory(req.params.circleId!, req.userId!);
    res.status(200).json(history);
  },

  async createReminder(req: Request, res: Response) {
    const reminder = await reassuranceService.createReminder(req.userId!, req.body.remindAt);
    res.status(201).json(reminder);
  },

  async listReminders(req: Request, res: Response) {
    const reminders = await reassuranceService.listReminders(req.userId!);
    res.status(200).json(reminders);
  },

  async deleteReminder(req: Request, res: Response) {
    await reassuranceService.deleteReminder(req.userId!, req.params.reminderId!);
    res.status(204).send();
  },
};
