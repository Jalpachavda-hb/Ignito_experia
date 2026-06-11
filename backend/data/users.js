/**
 * Shared in-memory user store.
 * Both auth (login) and user-management routes read/write from this single array.
 * This ensures newly created users can immediately log in.
 */

const users = [
  // ── Admins ──
  {
    id: "user-admin-001",
    name: "Meet Nayak",
    email: "admin@ignito.com",
    password: "admin123",
    role: "Super Admin",
    credits: 1000,
    status: "CONFIRMED",
    enabled: "True",
    created: "24-07-2025",
    updated: "24-07-2025",
  },
  {
    id: "user-002",
    name: "Meet Nayak",
    email: "meet.nayak@hackberrysoftech.in",
    password: "admin123",
    role: "Tenant Admin",
    credits: 1000,
    status: "CONFIRMED",
    enabled: "True",
    created: "24-07-2025",
    updated: "24-07-2025",
  },
  {
    id: "user-003",
    name: "Ankur Patel",
    email: "info@hackberrysoftech.com",
    password: "admin123",
    role: "Tenant Admin",
    credits: 1000,
    status: "CONFIRMED",
    enabled: "True",
    created: "23-07-2025",
    updated: "29-09-2025",
  },

  // ── Users ──
  {
    id: "user-jalpa-001",
    name: "Jalpa Rajpuriya",
    email: "jalpa@gmail.com",
    password: "jalpa123",
    role: "Student",
    credits: 1000,
    status: "CONFIRMED",
    enabled: "True",
    created: "10-12-2025",
    updated: "10-12-2025",
  },
  {
    id: "user-004",
    name: "Jalpa Rajpuriya",
    email: "jalpa.rajpuriya@hackberrysoftech.in",
    password: "jalpa123",
    role: "Tenant User",
    credits: 1000,
    status: "CONFIRMED",
    enabled: "True",
    created: "10-12-2025",
    updated: "10-12-2025",
  },
  {
    id: "user-005",
    name: "ayushi trivedi",
    email: "ayushi.hackberrysoftech@gmail.com",
    password: "ayushi123",
    role: "Tenant User",
    credits: 1000,
    status: "CONFIRMED",
    enabled: "True",
    created: "20-01-2026",
    updated: "20-01-2026",
  },
  {
    id: "user-006",
    name: "Hackberrysoftech",
    email: "hackberry123@gmail.com",
    password: "hackberry123",
    role: "Tenant User",
    credits: 1000,
    status: "CONFIRMED",
    enabled: "True",
    created: "16-01-2026",
    updated: "16-01-2026",
  },
];

// Auto-incrementing ID counter for new users
let nextIdNum = 7;

/**
 * Get all users (without exposing passwords).
 */
export function getAllUsers() {
  return users.map(({ password, ...rest }) => rest);
}

/**
 * Get the full internal user list (with passwords) — for auth only.
 */
export function getUsersInternal() {
  return users;
}

/**
 * Find a user by email (case-insensitive) and password.
 * Returns the user object (with password) or undefined.
 */
export function findUserByCredentials(email, password) {
  return users.find(
    (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
  );
}

/**
 * Find a user by ID.
 */
export function findUserById(id) {
  return users.find((u) => u.id === id || u.id === String(id));
}

/**
 * Add a new user to the store. Returns the created user (without password).
 */
export function addUser({ name, email, password, role }) {
  const now = new Date();
  const dateStr = `${String(now.getDate()).padStart(2, "0")}-${String(now.getMonth() + 1).padStart(2, "0")}-${now.getFullYear()}`;

  const newUser = {
    id: `user-${String(nextIdNum++).padStart(3, "0")}`,
    name: name || "New User",
    email,
    password: password || "password123",
    role: role || "Tenant User",
    credits: 1000,
    status: "CONFIRMED",
    enabled: "True",
    created: dateStr,
    updated: dateStr,
  };

  users.push(newUser);

  // Return without password
  const { password: _pw, ...safeUser } = newUser;
  return safeUser;
}

/**
 * Update a user's status by ID.
 */
export function updateUserStatusById(id, status) {
  const user = users.find((u) => u.id === id || u.id === String(id));
  if (!user) return null;

  const now = new Date();
  user.status = status;
  user.updated = `${String(now.getDate()).padStart(2, "0")}-${String(now.getMonth() + 1).padStart(2, "0")}-${now.getFullYear()}`;
  return user;
}
