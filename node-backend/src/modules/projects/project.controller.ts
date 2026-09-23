import type { RequestHandler } from 'express';

import {
  clarificationResponseSchema,
  createProjectSchema,
  projectClarificationParamsSchema,
  updateApprovalDepartmentSchema,
} from './project.schemas.js';
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

  readonly getApplicationDetail: RequestHandler = async (request, response) => {
    const application = await this.projectService.getApplicationDetail(
      request.user!.userId,
      request.params.id as string,
    );
    response.status(200).json({ status: 'success', data: { application } });
  };

  readonly listDocuments: RequestHandler = async (request, response) => {
    const documents = await this.projectService.listDocuments(request.user!.userId);
    response.status(200).json({ status: 'success', data: { documents } });
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

  readonly listClarifications: RequestHandler = async (request, response) => {
    const projectId = request.params.id as string;
    const clarifications = await this.projectService.listClarifications(
      request.user!.userId,
      projectId,
    );
    response.status(200).json({ status: 'success', data: { clarifications } });
  };

  readonly respondToClarification: RequestHandler = async (request, response) => {
    const { id, clarificationId } = projectClarificationParamsSchema.parse(request.params);
    const input = clarificationResponseSchema.parse(request.body);
    const clarifications = await this.projectService.respondToClarification(
      request.user!.userId,
      id,
      clarificationId,
      input,
    );
    response.status(201).json({ status: 'success', data: { clarifications } });
  };
}
