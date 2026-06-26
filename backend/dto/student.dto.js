import Joi from "joi";

export const studentQueryDto = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string().valid('FirstName', 'LastName', 'Email', 'CreatedAt', 'LastLogin', 'Status').default('CreatedAt'),
  sortOrder: Joi.string().valid('ASC', 'DESC', 'asc', 'desc').default('DESC'),
  status: Joi.string().valid('ACTIVE', 'INACTIVE', 'SUSPENDED', 'ARCHIVED').optional(),
  source: Joi.string().valid('DIRECT', 'LMS').optional(),
  universityId: Joi.number().integer().optional(),
  departmentId: Joi.number().integer().optional(),
  semesterId: Joi.number().integer().optional(),
  programId: Joi.number().integer().optional(),
  search: Joi.string().max(100).optional(),
});

export const updateStudentDto = Joi.object({
  FirstName: Joi.string().max(100).optional(),
  LastName: Joi.string().max(100).optional(),
  Email: Joi.string().email().max(255).optional(),
  Mobile: Joi.string().max(20).optional(),
  DepartmentId: Joi.number().integer().optional(),
  ProgramId: Joi.number().integer().optional(),
  SemesterId: Joi.number().integer().optional(),
  Batch: Joi.string().max(50).optional(),
  Section: Joi.string().max(50).optional(),
  Status: Joi.string().valid('ACTIVE', 'INACTIVE', 'SUSPENDED', 'ARCHIVED').optional(),
  Password: Joi.string().min(8).optional() // Handled securely via CommandService logic
});
