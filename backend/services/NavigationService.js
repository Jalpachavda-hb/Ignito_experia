class NavigationService {
  /**
   * Generates the frontend navigation structure based on role concept.
   */
  async buildNavigation(userRole, universityId) {
    const isTenantAdmin = ["TENANT_ADMIN", "TENANTADMIN", "SUPER_ADMIN", "SUPERADMIN", "ADMIN"].includes(
      (userRole || "").toUpperCase().replace(/\s+/g, "_")
    );

    if (isTenantAdmin) {
      return [
        { title: "Dashboard", icon: "DashboardIcon", path: "/admin/dashboard" },
        { title: "Students", icon: "PeopleIcon", path: "/admin/students" },
        { title: "Labs", icon: "ScienceIcon", path: "/admin/labs" },
        { title: "Courses", icon: "BookIcon", path: "/admin/courses" },
        { title: "Audit Logs", icon: "SecurityIcon", path: "/admin/audit" }
      ];
    }

    return [
      { title: "Dashboard", icon: "DashboardIcon", path: "/student/dashboard" },
      { title: "My Labs", icon: "ScienceIcon", path: "/student/my-labs" },
      { title: "Credit Wallet", icon: "AccountBalanceWalletIcon", path: "/student/credits" }
    ];
  }

  async getApplicationSettings() {
    return {
      MAINTENANCE_MODE: "false"
    };
  }
}

export const navigationService = new NavigationService();
export default navigationService;
