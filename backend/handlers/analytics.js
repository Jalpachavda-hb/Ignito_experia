import { dashboardAnalyticsService } from "../services/analytics/DashboardAnalyticsService.js";

// GET /admin/analytics/widgets/overview
export const analyticsOverviewWidgetHandler = async ({ queryStringParameters, auth }) => {
  const { timeRange } = queryStringParameters || {};
  // For standard user isolation, enforce their UniversityId unless they are a SuperAdmin viewing Global
  const targetUniversityId = auth.role === 'SUPER_ADMIN' ? 0 : auth.universityId;
  
  const data = await dashboardAnalyticsService.getOverviewWidget(timeRange || '7d', targetUniversityId);
  return { statusCode: 200, body: JSON.stringify({ success: true, widget: data }) };
};

// GET /admin/analytics/widgets/realtime
export const analyticsRealtimeWidgetHandler = async ({ auth }) => {
  const targetUniversityId = auth.role === 'SUPER_ADMIN' ? null : auth.universityId;
  const data = await dashboardAnalyticsService.getRealtimeWidget(targetUniversityId);
  return { statusCode: 200, body: JSON.stringify({ success: true, widget: data }) };
};
