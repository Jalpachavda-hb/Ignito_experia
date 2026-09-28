import { lmsCourseService } from "./LmsCourseService.js";

/** Semester lists are the semester portion of the LMS course payload. */
class LmsSemesterService {
  async getByProgramme(args) {
    const result = await lmsCourseService.getByProgramme({ ...args, semester: null });
    return {
      success: true,
      lmsStatus: result.lmsStatus,
      semesterList: result.semesterList || [],
    };
  }
}

export const lmsSemesterService = new LmsSemesterService();
