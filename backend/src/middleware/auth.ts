import { Request, Response, NextFunction } from "express";
import * as jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    company: string;
  };
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      console.log(`[AUTH] No token provided for ${req.method} ${req.path}`);
      return res.status(401).json({ error: "No token provided" });
    }

    console.log(`[AUTH] Verifying token for ${req.method} ${req.path}`);
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET!
    ) as jwt.JwtPayload;

    const company = (decoded.company || "").toUpperCase().trim();
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      company,
    };

    if (!req.user.company) {
      console.log(`[AUTH] ✗ Token missing company for user: ${req.user.email}`);
      return res.status(401).json({ error: "Invalid token: company missing" });
    }

    console.log(`[AUTH] ✓ Token verified for user: ${req.user.email}`);
    next();
  } catch (error) {
    console.log(`[AUTH] ✗ Invalid or expired token: ${error}`);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden: Insufficient permissions" });
    }

    next();
  };
};
