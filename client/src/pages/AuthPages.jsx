import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PublicLayout } from '../components/Layouts';
import { useAuth } from '../context/AuthContext';

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
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    caLevel: 'Intermediate',
    phone: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (
      !form.name.trim() ||
      !form.email.trim() ||
      !form.password ||
      !form.caLevel?.trim() ||
      !form.phone.trim()
    ) {
      setError('All fields are mandatory. Please fill in every field.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await register(form);
      navigate('/student');
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
          <h1>Student Registration</h1>
          <p className="muted">Join Mentaura CA online test &amp; evaluation series.</p>
          <label>
            Full name *
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label>
            Email *
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              autoComplete="off"
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
            Phone *
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="e.g. +91 9876543210"
              required
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="btn primary" disabled={busy}>
            {busy ? 'Creating…' : 'Create account'}
          </button>
          <p className="muted">
            Already registered? <Link to="/login">Login</Link>
          </p>
        </form>
      </section>
    </PublicLayout>
  );
}
