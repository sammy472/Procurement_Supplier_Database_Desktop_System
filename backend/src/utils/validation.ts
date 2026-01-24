/**
 * Backend Validation Utilities
 */

/**
 * Email validation regex - RFC 5322 simplified
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate email format
 */
export const isValidEmail = (email: string): boolean => {
  if (!email || typeof email !== "string") return false;
  return EMAIL_REGEX.test(email) && email.length <= 255;
};

/**
 * Validate password strength
 * Requirements: minimum 6 characters
 */
export const isValidPassword = (password: string): boolean => {
  if (!password || typeof password !== "string") return false;
  return password.length >= 6;
};

/**
 * Validate name field
 * Requirements: 2-100 characters, not empty
 */
export const isValidName = (name: string): boolean => {
  if (!name || typeof name !== "string") return false;
  const trimmed = name.trim();
  return trimmed.length >= 2 && trimmed.length <= 100;
};

/**
 * Validate profile update data
 */
export const validateProfileUpdate = (data: any): { valid: boolean; error?: string } => {
  // Check firstName
  if (!data.firstName || typeof data.firstName !== "string") {
    return { valid: false, error: "First name is required" };
  }
  if (!isValidName(data.firstName)) {
    return { valid: false, error: "First name must be between 2 and 100 characters" };
  }

  // Check lastName
  if (!data.lastName || typeof data.lastName !== "string") {
    return { valid: false, error: "Last name is required" };
  }
  if (!isValidName(data.lastName)) {
    return { valid: false, error: "Last name must be between 2 and 100 characters" };
  }

  // Check email
  if (!data.email || typeof data.email !== "string") {
    return { valid: false, error: "Email is required" };
  }
  if (!isValidEmail(data.email)) {
    return { valid: false, error: "Invalid email format" };
  }

  return { valid: true };
};

/**
 * Validate password change data
 */
export const validatePasswordChange = (data: any): { valid: boolean; error?: string } => {
  // Check currentPassword
  if (!data.currentPassword || typeof data.currentPassword !== "string") {
    return { valid: false, error: "Current password is required" };
  }

  // Check newPassword
  if (!data.newPassword || typeof data.newPassword !== "string") {
    return { valid: false, error: "New password is required" };
  }
  if (!isValidPassword(data.newPassword)) {
    return { valid: false, error: "New password must be at least 6 characters long" };
  }

  // Check confirmPassword
  if (!data.confirmPassword || typeof data.confirmPassword !== "string") {
    return { valid: false, error: "Password confirmation is required" };
  }

  // Check if passwords match
  if (data.newPassword !== data.confirmPassword) {
    return { valid: false, error: "Passwords do not match" };
  }

  return { valid: true };
};

/**
 * Validate login credentials
 */
export const validateLoginCredentials = (data: any): { valid: boolean; error?: string } => {
  // Check email
  if (!data.email || typeof data.email !== "string") {
    return { valid: false, error: "Email is required" };
  }
  if (!isValidEmail(data.email)) {
    return { valid: false, error: "Invalid email format" };
  }

  // Check password
  if (!data.password || typeof data.password !== "string") {
    return { valid: false, error: "Password is required" };
  }

  return { valid: true };
};

/**
 * Validate register credentials
 */
export const validateRegisterCredentials = (data: any): { valid: boolean; error?: string } => {
  // Check email
  if (!data.email || typeof data.email !== "string") {
    return { valid: false, error: "Email is required" };
  }
  if (!isValidEmail(data.email)) {
    return { valid: false, error: "Invalid email format" };
  }

  // Check password
  if (!data.password || typeof data.password !== "string") {
    return { valid: false, error: "Password is required" };
  }
  if (!isValidPassword(data.password)) {
    return { valid: false, error: "Password must be at least 6 characters long" };
  }

  // Check firstName
  if (!data.firstName || typeof data.firstName !== "string") {
    return { valid: false, error: "First name is required" };
  }
  if (!isValidName(data.firstName)) {
    return { valid: false, error: "First name must be between 2 and 100 characters" };
  }

  // Check lastName
  if (!data.lastName || typeof data.lastName !== "string") {
    return { valid: false, error: "Last name is required" };
  }
  if (!isValidName(data.lastName)) {
    return { valid: false, error: "Last name must be between 2 and 100 characters" };
  }

  return { valid: true };
};

/**
 * Validate password reset request
 */
export const validatePasswordResetRequest = (data: any): { valid: boolean; error?: string } => {
  if (!data.email || typeof data.email !== "string") {
    return { valid: false, error: "Email is required" };
  }
  if (!isValidEmail(data.email)) {
    return { valid: false, error: "Invalid email format" };
  }

  return { valid: true };
};

/**
 * Validate password reset
 */
export const validatePasswordReset = (data: any): { valid: boolean; error?: string } => {
  if (!data.token || typeof data.token !== "string") {
    return { valid: false, error: "Reset token is required" };
  }

  if (!data.newPassword || typeof data.newPassword !== "string") {
    return { valid: false, error: "New password is required" };
  }
  if (!isValidPassword(data.newPassword)) {
    return { valid: false, error: "Password must be at least 6 characters long" };
  }

  return { valid: true };
};
