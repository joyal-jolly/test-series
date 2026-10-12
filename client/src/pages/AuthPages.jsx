import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PublicLayout } from '../components/Layouts';
import { useAuth } from '../context/AuthContext';

function portalFor(role) {
  if (role === 'admin') return '/admin';
  if (role === 'reviewer') return '/reviewer';
  return '/student';
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('student@caacademy.com');
  const [password, setPassword] = useState('student123');
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
        <form className="panel form auth-form" onSubmit={submit}>
          <div className="auth-logo-center">
            <img src="/mentaura-logo.png" alt="Mentaura CA" className="auth-logo-img" />
          </div>
          <h1>Mentaura CA Portal Login</h1>
          <p className="muted">Students, reviewers, and admins use the same login.</p>
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="btn primary" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="muted">
            New student? <Link to="/register">Create an account</Link>
          </p>
          <div className="demo-creds">
            <p>Demo accounts</p>
            <code>student@caacademy.com / student123</code>
            <code>reviewer@caacademy.com / reviewer123</code>
            <code>admin@caacademy.com / admin123</code>
          </div>
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
    batch: '',
    phone: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
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
        <form className="panel form auth-form" onSubmit={submit}>
          <div className="auth-logo-center">
            <img src="/mentaura-logo.png" alt="Mentaura CA" className="auth-logo-img" />
          </div>
          <h1>Student Registration</h1>
          <p className="muted">Join Mentaura CA online test &amp; evaluation series.</p>
          <label>
            Full name
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={6}
            />
          </label>
          <label>
            CA Level
            <select value={form.caLevel} onChange={(e) => setForm({ ...form, caLevel: e.target.value })}>
              <option>Intermediate</option>
              <option>Final</option>
            </select>
          </label>
          <label>
            Batch
            <input value={form.batch} onChange={(e) => setForm({ ...form, batch: e.target.value })} />
          </label>
          <label>
            Phone
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
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
