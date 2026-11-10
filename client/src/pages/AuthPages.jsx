import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PublicLayout } from '../components/Layouts';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

function EyeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function portalFor(role) {
  if (role === 'admin') return '/admin';
  if (role === 'reviewer') return '/reviewer';
  return '/student';
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const user = await login(email, password);
      navigate(params.get('next') || portalFor(user.role));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PublicLayout>
      <section className="page-band auth-band">
        <form className="panel form auth-form" onSubmit={submit} autoComplete="off">
          <div className="auth-logo-center">
            <img src="/mentaura-logo.png" alt="Mentaura CA" className="auth-logo-img" />
          </div>
          <h1>Mentaura CA Portal Login</h1>
          <p className="muted">Students, reviewers, and admins use the same login.</p>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
              required
            />
          </label>
          <label>
            Password
            <div className="password-input-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword((prev) => !prev)}
                title={showPassword ? 'Hide password' : 'Show password'}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </label>
          {error && <p className="error">{error}</p>}
          <button className="btn primary" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="muted">
            New student? <Link to="/register">Create an account</Link>
          </p>
        </form>
      </section>
    </PublicLayout>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  // 'form' = filling user details; 'otp' = entering 4-digit verification code
  const [step, setStep] = useState('form');

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    caLevel: 'Intermediate',
    phone: '',
  });

  const [otpDigits, setOtpDigits] = useState(['', '', '', '']);
  const [otpToken, setOtpToken] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const digitInputsRef = useRef([]);

  // Countdown timer for Resend OTP button
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setInterval(() => {
      setResendCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCountdown]);

  // Focus the first box whenever we switch to OTP step
  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => {
        digitInputsRef.current[0]?.focus();
      }, 100);
    }
  }, [step]);

  function validateForm() {
    if (
      !form.name.trim() ||
      !form.email.trim() ||
      !form.password ||
      !form.caLevel?.trim() ||
      !form.phone.trim()
    ) {
      setError('All fields are mandatory. Please fill in every field.');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email.trim())) {
      setError('Please enter a valid email address.');
      return false;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return false;
    }
    return true;
  }

  // Step 1: Send 4-digit OTP to the entered email
  async function handleSendOtp(e) {
    if (e) e.preventDefault();
    if (!validateForm()) return;

    setBusy(true);
    setError('');
    setInfoMsg('');

    try {
      const res = await api('/api/auth/send-otp', {
        method: 'POST',
        body: { email: form.email.trim() },
      });

      setOtpToken(res.otpToken);
      setOtpDigits(['', '', '', '']);
      setResendCountdown(60);
      setStep('otp');
      setInfoMsg(res.message || `A 4-digit verification code was sent to ${form.email}.`);
    } catch (err) {
      setError(err.message || 'Failed to send verification code. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  // Resend OTP handler
  async function handleResendOtp() {
    if (resendCountdown > 0 || busy) return;
    setBusy(true);
    setError('');
    setInfoMsg('');

    try {
      const res = await api('/api/auth/send-otp', {
        method: 'POST',
        body: { email: form.email.trim() },
      });

      setOtpToken(res.otpToken);
      setOtpDigits(['', '', '', '']);
      setResendCountdown(60);
      setInfoMsg('A fresh 4-digit code has been sent to your email.');
      digitInputsRef.current[0]?.focus();
    } catch (err) {
      setError(err.message || 'Failed to resend code. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  // Handle single digit input box changes
  function handleDigitChange(index, value) {
    // Only accept numeric characters
    const cleanVal = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = cleanVal;
    setOtpDigits(newDigits);
    setError('');

    // Auto-focus next input if filled
    if (cleanVal && index < 3) {
      digitInputsRef.current[index + 1]?.focus();
    }
  }

  function handleDigitKeyDown(index, e) {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      // Move to previous input on backspace if current is empty
      digitInputsRef.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      digitInputsRef.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 3) {
      digitInputsRef.current[index + 1]?.focus();
    }
  }

  // Support pasting full 4-digit code into any box
  function handlePaste(e) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').trim().replace(/\D/g, '');
    if (!pasted) return;

    const newDigits = [...otpDigits];
    for (let i = 0; i < 4; i++) {
      if (pasted[i]) {
        newDigits[i] = pasted[i];
      }
    }
    setOtpDigits(newDigits);
    setError('');

    // Focus last filled box or verify button
    const lastFilledIdx = Math.min(pasted.length - 1, 3);
    digitInputsRef.current[lastFilledIdx]?.focus();
  }

  // Step 2: Submit Registration with 4-Digit OTP
  async function handleVerifyAndRegister(e) {
    e.preventDefault();
    const fullOtp = otpDigits.join('');

    if (fullOtp.length !== 4) {
      setError('Please enter the complete 4-digit verification code.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      await register({
        ...form,
        email: form.email.trim(),
        otp: fullOtp,
        otpToken,
      });
      navigate('/student');
    } catch (err) {
      setError(err.message || 'Invalid verification code. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <PublicLayout>
      <section className="page-band auth-band">
        {step === 'form' ? (
          /* ── STEP 1: REGISTRATION DETAILS FORM ── */
          <form className="panel form auth-form" onSubmit={handleSendOtp} autoComplete="off">
            <div className="auth-logo-center">
              <img src="/mentaura-logo.png" alt="Mentaura CA" className="auth-logo-img" />
            </div>
            <h1>Student Registration</h1>
            <p className="muted">Join Mentaura CA online test &amp; evaluation series.</p>

            <label>
              Full name *
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Joyal Jolly"
                required
              />
            </label>

            <label>
              Email address *
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                autoComplete="off"
                placeholder="e.g. student@gmail.com"
                required
              />
            </label>

            <label>
              Password *
              <div className="password-input-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  autoComplete="new-password"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword((prev) => !prev)}
                  title={showPassword ? 'Hide password' : 'Show password'}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </label>

            <label>
              CA Level *
              <select value={form.caLevel} onChange={(e) => setForm({ ...form, caLevel: e.target.value })} required>
                <option value="Intermediate">Intermediate</option>
                <option value="Final">Final</option>
              </select>
            </label>

            <label>
              Phone number *
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="e.g. +91 9876543210"
                required
              />
            </label>

            {error && <p className="error">{error}</p>}

            <button type="submit" className="btn primary" disabled={busy} style={{ marginTop: '0.5rem' }}>
              {busy ? 'Sending verification code…' : 'Continue with Email Verification →'}
            </button>

            <p className="muted">
              Already registered? <Link to="/login">Login</Link>
            </p>
          </form>
        ) : (
          /* ── STEP 2: 4-DIGIT EMAIL OTP VERIFICATION ── */
          <form className="panel form auth-form" onSubmit={handleVerifyAndRegister} autoComplete="off">
            <div className="otp-card-head">
              <div className="otp-icon-wrap" aria-hidden="true">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </div>
              <h1 style={{ margin: '0 0 0.5rem 0' }}>Verify Your Email</h1>
              <p className="muted" style={{ margin: 0 }}>
                We sent a 4-digit code to
              </p>
              <div>
                <span className="otp-email-badge">
                  <span>{form.email}</span>
                  <button
                    type="button"
                    className="otp-edit-email-btn"
                    onClick={() => {
                      setStep('form');
                      setError('');
                      setInfoMsg('');
                    }}
                    title="Change email address"
                  >
                    Change
                  </button>
                </span>
              </div>
            </div>

            <div className="otp-info-callout">
              Please enter the 4-digit code to confirm ownership of your email address. The code expires in 10 minutes.
            </div>

            {/* 4 Single-Digit Inputs with auto-jump & paste support */}
            <div className="otp-inputs-row" onPaste={handlePaste}>
              {[0, 1, 2, 3].map((index) => (
                <input
                  key={index}
                  ref={(el) => (digitInputsRef.current[index] = el)}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  className={`otp-digit-box ${otpDigits[index] ? 'filled' : ''}`}
                  value={otpDigits[index]}
                  onChange={(e) => handleDigitChange(index, e.target.value)}
                  onKeyDown={(e) => handleDigitKeyDown(index, e)}
                  autoComplete="one-time-code"
                  disabled={busy}
                  aria-label={`Digit ${index + 1}`}
                />
              ))}
            </div>

            {/* Resend & Timer */}
            <div className="otp-meta-row">
              <span>Didn&apos;t receive code?</span>
              {resendCountdown > 0 ? (
                <span style={{ fontSize: '0.85rem', color: 'var(--ink-soft)' }}>
                  Resend in <strong>{resendCountdown}s</strong>
                </span>
              ) : (
                <button
                  type="button"
                  className="otp-resend-btn"
                  onClick={handleResendOtp}
                  disabled={busy}
                >
                  Resend code
                </button>
              )}
            </div>

            {error && <p className="error" style={{ margin: '0.5rem 0' }}>{error}</p>}
            {infoMsg && !error && <p className="success" style={{ margin: '0.5rem 0', color: 'var(--brand-green)' }}>{infoMsg}</p>}

            <button
              type="submit"
              className="btn primary"
              disabled={busy || otpDigits.join('').length !== 4}
              style={{ marginTop: '0.75rem', width: '100%' }}
            >
              {busy ? 'Verifying & Creating Account…' : '✓ Verify & Complete Registration'}
            </button>

            <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => {
                  setStep('form');
                  setError('');
                }}
                disabled={busy}
              >
                ← Back to registration details
              </button>
            </div>
          </form>
        )}
      </section>
    </PublicLayout>
  );
}
