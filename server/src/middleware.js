import { verifyToken } from './auth.js';
import { dbService } from './db.js';

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    const payload = verifyToken(token);
    const user = await dbService.getUserById(payload.id);
    if (!user || user.status !== 'active') return res.status(401).json({ error: 'Invalid session' });
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      profile: user.profile || {},
    };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export async function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next();
  try {
    const payload = verifyToken(token);
    const user = await dbService.getUserById(payload.id);
    if (user && user.status === 'active') {
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        profile: user.profile || {},
      };
    }
  } catch {
    /* ignore */
  }
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}
