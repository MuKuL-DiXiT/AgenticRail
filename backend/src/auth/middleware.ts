import { Request, Response, NextFunction } from 'express';
import { AuthService, User, UserRole } from './authService';

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7).trim();
}

export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    return next();
  }

  const payload = AuthService.verifyToken(token);
  if (payload && payload.id) {
    const user = AuthService.getUserById(payload.id);
    if (user) {
      req.user = user;
    }
  }
  next();
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Authentication token is missing. Please log in.',
    });
  }

  const payload = AuthService.verifyToken(token);
  if (!payload || !payload.id) {
    return res.status(401).json({
      error: 'INVALID_TOKEN',
      message: 'Session expired or token is invalid. Please log in again.',
    });
  }

  const user = AuthService.getUserById(payload.id);
  if (!user) {
    return res.status(401).json({
      error: 'USER_NOT_FOUND',
      message: 'User belonging to this token no longer exists.',
    });
  }

  req.user = user;
  next();
}

export function requireRole(allowedRoles: UserRole | UserRole[]) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required.',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: `Access denied. Requires role: ${roles.join(' or ')}. Your role is ${req.user.role}.`,
      });
    }

    next();
  };
}

export function requireMerchant(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required.' });
  }

  if (req.user.role !== 'MERCHANT' || !req.user.merchant_id) {
    return res.status(403).json({
      error: 'FORBIDDEN',
      message: 'Access restricted to authenticated merchants with an active merchant store.',
    });
  }

  next();
}
