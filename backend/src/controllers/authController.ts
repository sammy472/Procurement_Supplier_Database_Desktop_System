import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { db } from "../db";
import * as schema from "../db/schema";
import * as bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt";
import { getCompanyFromEmail } from "../utils/dbHelper";
import { logActivity } from "../utils/audit";
import {
  validateLoginCredentials,
  validateRegisterCredentials,
  validateProfileUpdate,
  validatePasswordChange,
  validatePasswordResetRequest,
  validatePasswordReset,
} from "../utils/validation";

export const register = async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, firstName, lastName, role } = req.body;

    // Validate input
    const validation = validateRegisterCredentials({
      email,
      password,
      firstName,
      lastName,
    });
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Check if user exists
    const existingUser = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    if (existingUser.length > 0) {
      return res.status(400).json({ error: "User already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Determine company
    const company = getCompanyFromEmail(email);

    // Create user
    const [newUser] = await db
      .insert(schema.users)
      .values({
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role: role || "viewer",
        company,
      })
      .returning();

    // Remove password from response
    const { password: _, ...userWithoutPassword } = newUser;

    // Log activity
    await logActivity({
      userId: req.user!.id,
      action: "create",
      entityType: "user",
      entityId: newUser.id,
      description: `Created new user: ${email}`,
      newValue: { email, role },
      req: req as any,
    });

    res.status(201).json({ user: userWithoutPassword });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const login = async (req: AuthRequest, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validate input
    const validation = validateLoginCredentials({ email, password });
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    console.log("Login attempt for email:", email);

    // Find user
    const users = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    if (users.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = users[0];

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({ error: "Account is deactivated" });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate tokens
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
      company: (user.company || "").toUpperCase().trim(),
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Save refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await db.insert(schema.refreshTokens).values({
      userId: user.id,
      token: refreshToken,
      expiresAt,
    });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    // Log activity
    await logActivity({
      userId: user.id,
      action: "login",
      entityType: "auth",
      description: "User logged in",
      req: req as any,
    });

    res.json({
      user: userWithoutPassword,
      accessToken,
      refreshToken,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const refreshToken = async (req: AuthRequest, res: Response) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return res.status(401).json({ error: "Refresh token required" });
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(token);

    // Check if token exists in database
    const storedTokens = await db
      .select()
      .from(schema.refreshTokens)
      .where(eq(schema.refreshTokens.token, token))
      .limit(1);

    if (storedTokens.length === 0) {
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    const storedToken = storedTokens[0];

    // Check if token is expired
    if (new Date() > storedToken.expiresAt) {
      await db
        .delete(schema.refreshTokens)
        .where(eq(schema.refreshTokens.id, storedToken.id));
      return res.status(401).json({ error: "Refresh token expired" });
    }

    // Generate new access token
    let company = (decoded.company || "").toUpperCase().trim();
    if (!company) {
      const users = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, decoded.id))
        .limit(1);
      if (users.length === 0) {
        return res.status(401).json({ error: "Invalid refresh token: user not found" });
      }
      company = (users[0].company || "").toUpperCase().trim();
    }
    const payload = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      company,
    };

    const accessToken = generateAccessToken(payload);

    res.json({ accessToken });
  } catch (error: any) {
    res.status(401).json({ error: "Invalid refresh token" });
  }
};

export const logout = async (req: AuthRequest, res: Response) => {
  try {
    const { refreshToken: token } = req.body;

    if (token) {
      await db
        .delete(schema.refreshTokens)
        .where(eq(schema.refreshTokens.token, token));
    }

    // Log activity
    if (req.user) {
      await logActivity({
        userId: req.user.id,
        action: "logout",
        entityType: "auth",
        description: "User logged out",
        req: req as any,
      });
    }

    res.json({ message: "Logged out successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const users = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, req.user.id))
      .limit(1);

    if (users.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = users[0];
    const { password: _, ...userWithoutPassword } = user;

    res.json({ user: userWithoutPassword });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { firstName, lastName, email } = req.body;

    // Validate input
    const validation = validateProfileUpdate({ firstName, lastName, email });
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Check if email is already in use by another user
    if (email !== req.user.email) {
      const existingUsers = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, email))
        .limit(1);

      if (existingUsers.length > 0) {
        return res.status(400).json({ error: "Email is already in use" });
      }
    }

    // Update user
    const [updatedUser] = await db
      .update(schema.users)
      .set({ firstName, lastName, email, updatedAt: new Date() })
      .where(eq(schema.users.id, req.user.id))
      .returning();

    const { password: _, ...userWithoutPassword } = updatedUser;

    // Log activity
    await logActivity({
      userId: req.user.id,
      action: "update",
      entityType: "profile",
      description: "User updated their profile",
      newValue: { firstName, lastName, email },
      req: req as any,
    });

    res.json({ user: userWithoutPassword, message: "Profile updated successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getUsers = async (req: AuthRequest, res: Response) => {
  try {
    const company = req.user?.company;
    const companyFilter =
      company === "ONK_GROUP" || company === "ANT_SAVY" ? company : undefined;
    if (!companyFilter) {
      return res.status(400).json({ error: "Invalid company" });
    }
    const users = await db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        role: schema.users.role,
        isActive: schema.users.isActive,
      })
      .from(schema.users)
      .where(eq(schema.users.company, companyFilter));

    res.json({ users });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const changePassword = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Validate input
    const validation = validatePasswordChange({
      currentPassword,
      newPassword,
      confirmPassword,
    });
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Get current user with password
    const users = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, req.user.id))
      .limit(1);

    if (users.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = users[0];

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await db
      .update(schema.users)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(eq(schema.users.id, req.user.id));

    // Log activity
    await logActivity({
      userId: req.user.id,
      action: "change_password",
      entityType: "auth",
      description: "User changed their password",
      req: req as any,
    });

    res.json({ message: "Password changed successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const requestPasswordReset = async (req: AuthRequest, res: Response) => {
  try {
    const { email } = req.body;

    // Validate input
    const validation = validatePasswordResetRequest({ email });
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Check if user exists
    const users = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    if (users.length === 0) {
      // Don't reveal if user exists for security
      return res.json({ message: "If user exists, password reset link has been sent to email" });
    }

    const user = users[0];

    // Generate reset token
    const resetToken = require("crypto").randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Expires in 1 hour

    // Store reset token
    await db.insert(schema.passwordResetTokens).values({
      userId: user.id,
      token: resetToken,
      expiresAt,
    });

    // In production, send email with reset link
    // For now, return token in response (not secure for production)
    console.log(`Password reset token for ${email}: ${resetToken}`);

    res.json({
      message: "Password reset link sent to email",
      resetToken,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const resetPassword = async (req: AuthRequest, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    // Validate input
    const validation = validatePasswordReset({ token, newPassword });
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Find reset token
    const tokens = await db
      .select()
      .from(schema.passwordResetTokens)
      .where(eq(schema.passwordResetTokens.token, token))
      .limit(1);

    if (tokens.length === 0) {
      return res.status(400).json({ error: "Invalid or expired reset token" });
    }

    const resetToken = tokens[0];

    // Check if token is expired
    if (new Date() > resetToken.expiresAt) {
      await db
        .delete(schema.passwordResetTokens)
        .where(eq(schema.passwordResetTokens.id, resetToken.id));
      return res.status(400).json({ error: "Reset token has expired" });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user password
    await db
      .update(schema.users)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(eq(schema.users.id, resetToken.userId));

    // Delete used reset token
    await db
      .delete(schema.passwordResetTokens)
      .where(eq(schema.passwordResetTokens.id, resetToken.id));

    // Log activity
    await logActivity({
      userId: resetToken.userId,
      action: "reset_password",
      entityType: "auth",
      description: "User reset password",
      req: req as any,
    });

    res.json({ message: "Password reset successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
