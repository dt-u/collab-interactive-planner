import { Request, Response, NextFunction } from "express";
import { WorkspaceService } from "./workspace.service.js";

export class WorkspaceController {
  constructor(
    private workspaceService: WorkspaceService = new WorkspaceService(),
  ) {}

  create = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { name } = req.body;
      const ownerId = req.user?.userId;
      if (!ownerId) {
        res
          .status(401)
          .json({ success: false, error: { message: "Unauthorized" } });
        return;
      }
      const workspace = await this.workspaceService.createWorkspace(
        name,
        ownerId,
      );
      res.status(201).json({ success: true, data: workspace });
    } catch (error) {
      next(error);
    }
  };

  list = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res
          .status(401)
          .json({ success: false, error: { message: "Unauthorized" } });
        return;
      }
      const list = await this.workspaceService.getUserWorkspaces(userId);
      res.status(200).json({ success: true, data: list });
    } catch (error) {
      next(error);
    }
  };

  get = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const workspaceId = req.params.id;
      const userId = req.user?.userId;
      if (!userId) {
        res
          .status(401)
          .json({ success: false, error: { message: "Unauthorized" } });
        return;
      }
      const workspace = await this.workspaceService.getWorkspaceDetails(
        workspaceId,
        userId,
      );
      res.status(200).json({ success: true, data: workspace });
    } catch (error) {
      next(error);
    }
  };

  update = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const workspaceId = req.params.id;
      const userId = req.user?.userId;
      if (!userId) {
        res
          .status(401)
          .json({ success: false, error: { message: "Unauthorized" } });
        return;
      }

      const workspace = await this.workspaceService.updateWorkspace(
        workspaceId,
        userId,
        req.body,
      );
      res.status(200).json({ success: true, data: workspace });
    } catch (error) {
      next(error);
    }
  };

  invite = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const workspaceId = req.params.id;
      const inviterId = req.user?.userId;
      const { email, role } = req.body;

      if (!inviterId) {
        res
          .status(401)
          .json({ success: false, error: { message: "Unauthorized" } });
        return;
      }

      const updatedWorkspace = await this.workspaceService.inviteMember(
        workspaceId,
        inviterId,
        email,
        role,
      );

      res.status(200).json({ success: true, data: updatedWorkspace });
    } catch (error) {
      next(error);
    }
  };

  delete = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const workspaceId = req.params.id;
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: { message: "Unauthorized" } });
        return;
      }

      await this.workspaceService.deleteWorkspace(workspaceId, userId);
      res.status(200).json({ success: true, data: { message: "Workspace deleted successfully" } });
    } catch (error) {
      next(error);
    }
  };

  leave = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const workspaceId = req.params.id;
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: { message: "Unauthorized" } });
        return;
      }

      await this.workspaceService.leaveWorkspace(workspaceId, userId);
      res.status(200).json({ success: true, data: { message: "Left workspace successfully" } });
    } catch (error) {
      next(error);
    }
  };

  listPendingInvitations = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: { message: "Unauthorized" } });
        return;
      }

      const list = await this.workspaceService.getPendingInvitations(userId);
      res.status(200).json({ success: true, data: list });
    } catch (error) {
      next(error);
    }
  };

  acceptInvitation = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { invitationId } = req.params;
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: { message: "Unauthorized" } });
        return;
      }

      const workspace = await this.workspaceService.acceptInvitation(invitationId, userId);
      res.status(200).json({ success: true, data: workspace });
    } catch (error) {
      next(error);
    }
  };

  declineInvitation = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { invitationId } = req.params;
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: { message: "Unauthorized" } });
        return;
      }

      await this.workspaceService.declineInvitation(invitationId, userId);
      res.status(200).json({ success: true, data: { message: "Invitation declined successfully" } });
    } catch (error) {
      next(error);
    }
  };
}
