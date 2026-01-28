/**
 * Email validation utility
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
};

/**
 * Password validation utility
 * Requirements: minimum 6 characters
 */
export const isValidPassword = (password: string): boolean => {
  return password.length >= 6;
};

/**
 * Name validation utility
 * Requirements: minimum 2 characters, maximum 100 characters
 */
export const isValidName = (name: string): boolean => {
  return name.trim().length >= 2 && name.trim().length <= 100;
};

/**
 * Validate profile update data
 */
export const validateProfileUpdate = (data: {
  firstName: string;
  lastName: string;
  email: string;
}): { valid: boolean; error?: string } => {
  // Check firstName
  if (!data.firstName || !data.firstName.trim()) {
    return { valid: false, error: "First name is required" };
  }
  if (!isValidName(data.firstName)) {
    return { valid: false, error: "First name must be between 2 and 100 characters" };
  }

  // Check lastName
  if (!data.lastName || !data.lastName.trim()) {
    return { valid: false, error: "Last name is required" };
  }
  if (!isValidName(data.lastName)) {
    return { valid: false, error: "Last name must be between 2 and 100 characters" };
  }

  // Check email
  if (!data.email || !data.email.trim()) {
    return { valid: false, error: "Email is required" };
  }
  if (!isValidEmail(data.email)) {
    return { valid: false, error: "Please enter a valid email address" };
  }

  return { valid: true };
};

/**
 * Validate password change data
 */
export const validatePasswordChange = (data: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): { valid: boolean; error?: string } => {
  // Check currentPassword
  if (!data.currentPassword) {
    return { valid: false, error: "Current password is required" };
  }

  // Check newPassword
  if (!data.newPassword) {
    return { valid: false, error: "New password is required" };
  }
  if (!isValidPassword(data.newPassword)) {
    return { valid: false, error: "New password must be at least 6 characters long" };
  }

  // Check confirmPassword
  if (!data.confirmPassword) {
    return { valid: false, error: "Please confirm your new password" };
  }

  // Check if passwords match
  if (data.newPassword !== data.confirmPassword) {
    return { valid: false, error: "New passwords do not match" };
  }

  // Check if new password is different from current
  if (data.currentPassword === data.newPassword) {
    return { valid: false, error: "New password must be different from current password" };
  }

  return { valid: true };
};

/**
 * Validate login credentials
 */
export const validateLoginCredentials = (data: {
  email: string;
  password: string;
}): { valid: boolean; error?: string } => {
  // Check email
  if (!data.email || !data.email.trim()) {
    return { valid: false, error: "Email is required" };
  }
  if (!isValidEmail(data.email)) {
    return { valid: false, error: "Please enter a valid email address" };
  }

  // Check password
  if (!data.password) {
    return { valid: false, error: "Password is required" };
  }
  if (data.password.length < 1) {
    return { valid: false, error: "Please enter your password" };
  }

  return { valid: true };
};

/**
 * Validate password reset request
 */
export const validatePasswordResetRequest = (email: string): { valid: boolean; error?: string } => {
  if (!email || !email.trim()) {
    return { valid: false, error: "Email is required" };
  }
  if (!isValidEmail(email)) {
    return { valid: false, error: "Please enter a valid email address" };
  }

  return { valid: true };
};

/**
 * Validate password reset
 */
export const validatePasswordReset = (data: {
  token: string;
  newPassword: string;
}): { valid: boolean; error?: string } => {
  if (!data.token || !data.token.trim()) {
    return { valid: false, error: "Reset token is required" };
  }

  if (!data.newPassword) {
    return { valid: false, error: "New password is required" };
  }
  if (!isValidPassword(data.newPassword)) {
    return { valid: false, error: "Password must be at least 6 characters long" };
  }

  return { valid: true };
};
