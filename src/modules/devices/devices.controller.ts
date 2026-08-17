import type { Request, Response } from "express";
import { devicesService } from "@/modules/devices/devices.service";

export const devicesController = {
  async list(req: Request, res: Response) {
    const devices = await devicesService.listDevices(req.userId!);
    res.status(200).json(devices);
  },

  async register(req: Request, res: Response) {
    const { deviceId, platform, pushToken } = req.body;
    const device = await devicesService.registerDevice(req.userId!, deviceId, platform, pushToken);
    res.status(201).json(device);
  },

  async unpair(req: Request, res: Response) {
    await devicesService.unpairDevice(req.userId!, req.params.deviceId!);
    res.status(204).send();
  },
};
