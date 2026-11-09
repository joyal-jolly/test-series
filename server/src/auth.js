import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const TOKEN_DAYS = 7;

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is not configured');
  }
  return 'ca-academy-dev-secret-change-me'; // local dev only
}

export function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

export function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    getSecret(),
    { expiresIn: `${TOKEN_DAYS}d` }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, getSecret());
}