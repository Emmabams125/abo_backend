import type { Request, Response } from "express";
import { subscriptionService } from "@/modules/subscription/subscription.service";

export const subscriptionController = {
  async getPlans(_req: Request, res: Response) {
    const plans = await subscriptionService.getPlans();
    res.status(200).json(plans);
  },

  async getSubscription(req: Request, res: Response) {
    const subscription = await subscriptionService.getSubscription(req.params.circleId!);
    res.status(200).json(subscription);
  },

  async changeTier(req: Request, res: Response) {
    const { tier, billingProvider } = req.body;
    const subscription = await subscriptionService.changeTier(
      req.params.circleId!,
      req.userId!,
      tier,
      billingProvider
    );
    res.status(200).json(subscription);
  },

  async listInvoices(req: Request, res: Response) {
    const invoices = await subscriptionService.listInvoices(req.params.circleId!, req.userId!);
    res.status(200).json(invoices);
  },
};
