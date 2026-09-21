import type { RequestHandler } from 'express';

import { createProjectSchema, updateApprovalDepartmentSchema } from './project.schemas.js';
import type { ProjectService } from './project.service.js';

export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  readonly create: RequestHandler = async (request, response) => {
    const input = createProjectSchema.parse(request.body);
    const project = await this.projectService.createProject(request.user!.userId, input);
    response.status(201).json({ status: 'success', data: { project } });
  };

  readonly list: RequestHandler = async (request, response) => {
    const projects = await this.projectService.listProjects(request.user!.userId);
    response.status(200).json({ status: 'success', data: { projects } });
  };

  readonly getOne: RequestHandler = async (request, response) => {
    const project = await this.projectService.getProject(
      request.user!.userId,
      request.params.id as string,
    );
    response.status(200).json({ status: 'success', data: { project } });
  };

  readonly listDepartments: RequestHandler = async (_request, response) => {
    const departments = await this.projectService.listDepartments();
    response.status(200).json({ status: 'success', data: { departments } });
  };

  readonly submit: RequestHandler = async (request, response) => {
    const project = await this.projectService.submitProject(
      request.user!.userId,
      request.params.id as string,
    );
    response.status(200).json({ status: 'success', data: { project } });
  };

  readonly updateApprovalDepartment: RequestHandler = async (request, response) => {
    const { departmentKey } = updateApprovalDepartmentSchema.parse(request.body);
    const approval = await this.projectService.setApprovalDepartment(
      request.user!.userId,
      request.params.id as string,
      request.params.approvalId as string,
      departmentKey,
    );
    response.status(200).json({ status: 'success', data: { approval } });
  };
}
