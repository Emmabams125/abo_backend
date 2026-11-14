import type { Request, Response } from "express";
import { circlesService } from "@/modules/circles/circles.service";

export const circlesController = {
  async create(req: Request, res: Response) {
    const circle = await circlesService.createCircle(req.body.name, req.userId!);
    res.status(201).json(circle);
  },

  async listMembers(req: Request, res: Response) {
    const members = await circlesService.listMembers(req.params.circleId!, req.userId!);
    res.status(200).json(members);
  },

  async createInvite(req: Request, res: Response) {
    const invite = await circlesService.createInvite(req.params.circleId!, req.userId!);
    res.status(201).json(invite);
  },

  async acceptInvite(req: Request, res: Response) {
    const result = await circlesService.acceptInvite(req.body.code, req.userId!);
    res.status(200).json(result);
  },

  async listMine(req: Request, res: Response) {
    const memberships = await circlesService.listMyMemberships(req.userId!);
    res.status(200).json(memberships);
  },

  async listPending(req: Request, res: Response) {
    const pending = await circlesService.listPendingMemberships(req.params.circleId!, req.userId!);
    res.status(200).json(pending);
  },

  async declineMembership(req: Request, res: Response) {
    const membership = await circlesService.declineMembership(
      req.params.circleId!,
      req.params.membershipId!,
      req.userId!
    );
    res.status(200).json(membership);
  },

  async approveMembership(req: Request, res: Response) {
    const membership = await circlesService.approveMembership(
      req.params.circleId!,
      req.params.membershipId!,
      req.userId!
    );
    res.status(200).json(membership);
  },

  async changeRole(req: Request, res: Response) {
    const membership = await circlesService.changeRole(
      req.params.circleId!,
      req.params.membershipId!,
      req.body.role,
      req.userId!
    );
    res.status(200).json(membership);
  },

  async removeMember(req: Request, res: Response) {
    const membership = await circlesService.removeMember(
      req.params.circleId!,
      req.params.membershipId!,
      req.userId!
    );
    res.status(200).json(membership);
  },

  async acknowledgeManagedNotice(req: Request, res: Response) {
    const membership = await circlesService.acknowledgeManagedNotice(
      req.params.circleId!,
      req.params.membershipId!,
      req.userId!
    );
    res.status(200).json(membership);
  },

  async listAuditLogs(req: Request, res: Response) {
    const logs = await circlesService.listAuditLogs(req.params.circleId!, req.userId!);
    res.status(200).json(logs);
  },
};
