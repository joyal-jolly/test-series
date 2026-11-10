import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const TOKEN_DAYS = 7;
const OTP_EXPIRY_MINUTES = 10;
const DEFAULT_SECRET = 'mentaura-ca-secure-jwt-secret-replace-in-production';

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret && typeof secret === 'string' && secret.trim()) {
    return secret.trim();
  }
  // Fallback so server never crashes with 502 if secret wasn't injected yet
  return DEFAULT_SECRET;
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

/**
 * Generates a clean 4-digit numeric string (1000 - 9999).
 * Uses universal math/crypto so it runs anywhere without dependency quirks.
 */
export function generateOtp() {
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const array = new Uint32Array(1);
    globalThis.crypto.getRandomValues(array);
    return String(1000 + (array[0] % 9000));
  }
  return String(Math.floor(1000 + Math.random() * 9000));
}

/**
 * Generates a signed JWT token containing the email and OTP.
 * Valid for 10 minutes.
 */
export function createOtpToken(email, otp) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const cleanOtp = String(otp || '').trim();

  return jwt.sign(
    {
      email: normalizedEmail,
      otp: cleanOtp,
      type: 'registration_otp',
    },
    getSecret(),
    { expiresIn: `${OTP_EXPIRY_MINUTES}m` }
  );
}

/**
 * Verifies the user-submitted OTP against the signed token.
 */
export function verifyOtpToken(email, otp, otpToken) {
  if (!email || !otp || !otpToken) return false;
  try {
    const decoded = jwt.verify(otpToken, getSecret());
    if (decoded.type !== 'registration_otp') return false;

    const tokenEmail = String(decoded.email || '').trim().toLowerCase();
    const inputEmail = String(email || '').trim().toLowerCase();
    if (tokenEmail !== inputEmail) return false;

    const tokenOtp = String(decoded.otp || '').trim();
    const inputOtp = String(otp || '').trim();
    return tokenOtp === inputOtp;
  } catch {
    return false;
  }
}
