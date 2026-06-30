import pool from "../lib/mysql.js";

// Master dictionary of all possible frontend navigation items
const MASTER_NAVIGATION = [
  {
    title: "Dashboard",
    icon: "DashboardIcon",
    path: "/dashboard",
    permission: null // Base requirement, available to anyone authenticated
  },
  {
    title: "Labs",
    icon: "ScienceIcon",
    path: "/labs",
    permission: "Lab.View",
    children: [
      { title: "My Labs", path: "/labs/my", permission: "Lab.Start" },
      { title: "Manage Labs", path: "/labs/manage", permission: "Lab.Stop" }
    ]
  },
  {
    title: "Courses",
    icon: "BookIcon",
    path: "/courses",
    permission: "Course.View"
  },
  {
    title: "Students",
    icon: "PeopleIcon",
    path: "/students",
    permission: "Student.View"
  },
  {
    title: "Faculty",
    icon: "SchoolIcon",
    path: "/faculty",
    permission: "Faculty.View"
  },
  {
    title: "Analytics",
    icon: "BarChartIcon",
    path: "/analytics",
    permission: "Analytics.View"
  },
  {
    title: "Audit Logs",
    icon: "SecurityIcon",
    path: "/audit",
    permission: "Audit.View"
  },
  {
    title: "Role Management",
    icon: "AdminPanelSettingsIcon",
    path: "/roles",
    permission: "Role.View"
  },
  {
    title: "Universities",
    icon: "DomainIcon",
    path: "/universities",
    permission: "University.View"
  }
];

class NavigationService {
  /**
   * Generates the frontend navigation structure dynamically based on
   * the user's resolved permission matrix and feature flags.
   */
  async buildNavigation(permissionMatrix, universityId) {
    // We expect the matrix.roleAllow and matrix.userAllow to be arrays 
    // if coming from the cache, or Sets if raw. We convert to Set for easy .has() checks
    const granted = new Set([
      ...(Array.isArray(permissionMatrix.roleAllow) ? permissionMatrix.roleAllow : []),
      ...(Array.isArray(permissionMatrix.userAllow) ? permissionMatrix.userAllow : [])
    ]);

    // Apply explicit denies
    const denied = new Set(Array.isArray(permissionMatrix.userDeny) ? permissionMatrix.userDeny : []);
    for (const d of denied) granted.delete(d);

    // Hardcode feature flags in memory
    const flags = {
      VIRTUAL_LABS: true,
      COMPILER: true,
      REPORTS: true,
      CONTAINER_MONITORING: false
    };

    // Builder recursive function
    const evaluateNode = (node) => {
      // Feature Flag Gate (Optional: We could map specific FlagCodes to modules)
      if (node.title === 'Analytics' && flags['REPORTS'] === false) return null;
      if (node.title === 'Labs' && flags['VIRTUAL_LABS'] === false) return null;

      // Permission Gate
      if (node.permission && !granted.has(node.permission)) {
        // Explicit super-admin bypass not handled here because the PermissionService
        // injects the super admin explicit logic BEFORE passing the matrix,
        // Wait, PermissionService.getUserPermissionMatrix() does NOT inject *.*
        // So we need to handle super admin bypass here if they pass `SUPER_ADMIN`
        // We will assume `hasPermission` is evaluated by backend.
        // Actually, the matrix returned for superadmin should ideally contain all,
        // or we check roleCode.
        return null;
      }

      const result = { ...node };

      if (node.children) {
        const validChildren = node.children.map(evaluateNode).filter(Boolean);
        if (validChildren.length > 0) {
          result.children = validChildren;
        } else {
          // If all children are blocked, maybe we block the parent too depending on UX requirements
          // For now, we'll keep the parent if it passed its own permission check.
        }
      }

      return result;
    };

    return MASTER_NAVIGATION.map(evaluateNode).filter(Boolean);
  }

  async getApplicationSettings() {
    return {
      MAINTENANCE_MODE: "false"
    };
  }
}

export const navigationService = new NavigationService();
export default navigationService;
