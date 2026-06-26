import studentProfileRepository from "../repositories/StudentProfileRepository.js";
import { cacheProvider } from "../lib/cache.js";
import { notFound } from "../lib/errors.js";

class StudentQueryService {
  async getStudents(filters = {}, pagination = {}, sort = {}) {
    const cacheKey = `students:list:${JSON.stringify({ filters, pagination, sort })}`;
    
    // Try Cache
    const cached = await cacheProvider.get(cacheKey);
    if (cached) return cached;

    // Fetch from DB
    const result = await studentProfileRepository.findAndCountAll(filters, pagination, sort);
    
    // Cache for 1 minute (short-lived due to frequent changes)
    await cacheProvider.set(cacheKey, result, 60);

    return result;
  }

  async getStudentDetail(profileId) {
    const cacheKey = `students:detail:${profileId}`;
    
    const cached = await cacheProvider.get(cacheKey);
    if (cached) return cached;

    const profile = await studentProfileRepository.findById(profileId);
    if (!profile) {
      throw notFound("Student profile not found");
    }

    // Additional data enrichment (e.g. login metadata, recent sessions) could be attached here
    // For now we just return the full profile
    const result = {
      ...profile,
      // The requirement asked for complete profile with login metadata
      loginMetadata: {
        lastLogin: profile.LastLogin,
        source: profile.AuthenticationSource
      }
    };

    await cacheProvider.set(cacheKey, result, 120);

    return result;
  }
}

export const studentQueryService = new StudentQueryService();
export default studentQueryService;
