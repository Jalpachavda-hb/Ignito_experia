import { studentQueryService } from "../services/StudentQueryService.js";
import { studentCommandService } from "../services/StudentCommandService.js";
import { studentStatisticsService } from "../services/StudentStatisticsService.js";
import { validate } from "../lib/validation.js";
import { studentQueryDto, updateStudentDto } from "../dto/student.dto.js";

// GET /admin/students
export const studentsListHandler = async ({ queryStringParameters }) => {
  const params = validate(studentQueryDto, queryStringParameters || {});
  
  const filters = {
    status: params.status,
    source: params.source,
    universityId: params.universityId,
    departmentId: params.departmentId,
    semesterId: params.semesterId,
    programId: params.programId,
    search: params.search
  };

  const pagination = { page: params.page, limit: params.limit };
  const sort = { sortBy: params.sortBy, sortOrder: params.sortOrder };

  const result = await studentQueryService.getStudents(filters, pagination, sort);
  return { statusCode: 200, body: JSON.stringify({ success: true, ...result }) };
};

// GET /admin/students/statistics
export const studentsStatisticsHandler = async () => {
  const result = await studentStatisticsService.getSummary();
  return { statusCode: 200, body: JSON.stringify({ success: true, statistics: result }) };
};

// GET /admin/students/:id
export const studentsDetailHandler = async ({ pathParameters }) => {
  const { id } = pathParameters;
  const result = await studentQueryService.getStudentDetail(id);
  return { statusCode: 200, body: JSON.stringify({ success: true, student: result }) };
};

// PUT /admin/students/:id
export const studentsUpdateHandler = async ({ pathParameters, body, requestContext, auth }) => {
  const { id } = pathParameters;
  const validatedBody = validate(updateStudentDto, body || {});
  
  const changedByUserId = auth?.userId || requestContext?.authorizer?.userId || null;
  const result = await studentCommandService.updateStudent(id, validatedBody, changedByUserId);
  return { statusCode: 200, body: JSON.stringify({ success: true, ...result }) };
};

// PATCH /admin/students/:id/status
export const studentsStatusHandler = async ({ pathParameters, body, requestContext, auth }) => {
  const { id } = pathParameters;
  const changedByUserId = auth?.userId || requestContext?.authorizer?.userId || null;
  
  const status = body?.status;
  if (!['ACTIVE', 'INACTIVE', 'SUSPENDED', 'ARCHIVED'].includes(status)) {
    return { statusCode: 400, body: JSON.stringify({ success: false, message: "Invalid status" }) };
  }

  const result = await studentCommandService.updateStudent(id, { Status: status }, changedByUserId);
  return { statusCode: 200, body: JSON.stringify({ success: true, ...result }) };
};
