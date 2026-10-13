import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function PublicLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function portalPath() {
    if (!user) return '/login';
    if (user.role === 'admin') return '/admin';
    if (user.role === 'reviewer') return '/reviewer';
    return '/student';
  }

  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="brand">
          <span className="brand-mark logo-mark">
            <img src="/mentaura-logo.png" alt="Mentaura CA" className="brand-logo-img" />
          </span>
          <span className="brand-text">
            <strong>Mentaura CA</strong>
            <em>Assessment Series</em>
          </span>
        </Link>
        <nav className="nav">
          <NavLink to="/">Home</NavLink>
          <NavLink to="/papers">Question Papers</NavLink>
          <NavLink to="/about">About Campus</NavLink>
          <NavLink to="/contact">Contact & Admissions</NavLink>
          <a href="https://mentauraca.info/" target="_blank" rel="noreferrer" className="nav-external">
            Official Website ↗
          </a>
        </nav>
        <div className="top-actions">
          {user ? (
            <>
              <button className="btn ghost" onClick={() => navigate(portalPath())}>
                {user.name.split(' ')[0]} · Portal
              </button>
              <button className="btn subtle" onClick={logout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <Link className="btn ghost" to="/login">
                Login
              </Link>
              <Link className="btn primary" to="/register">
                Register
              </Link>
            </>
          )}
        </div>
      </header>
      <main>{children}</main>
      <footer className="site-footer">
        <div className="footer-brand-col">
          <div className="footer-brand-header">
            <img src="/mentaura-logo.png" alt="Mentaura CA" className="footer-logo" />
            <div>
              <strong>Mentaura CA Residential Campus</strong>
              <p className="footer-tagline">Committed to Your Success</p>
            </div>
          </div>
          <p className="footer-mission">
            Shaping India&apos;s finest Chartered Accountants through excellence, discipline, and care.
            Programs for CA Intermediate, CA Final, and Crash Courses with residential immersion.
          </p>
          <div className="footer-contact-info">
            <p>📍 Kadalikadu P.O., Manjalloor, Vazhakulam, Ernakulam, Kerala</p>
            <p>
              📞 <a href="tel:+916282955052">+91 6282955052</a>
              <span className="bullet">·</span>
              ✉️ <a href="mailto:mentauraca@gmail.com">mentauraca@gmail.com</a>
            </p>
          </div>
        </div>
        <div className="footer-links">
          <div>
            <h4>Assessment Portal</h4>
            <Link to="/papers">Question Papers</Link>
            <Link to="/login">Student Login</Link>
            <Link to="/register">Register Attempt</Link>
          </div>
          <div>
            <h4>Campus & Info</h4>
            <Link to="/about">About Mentaura</Link>
            <Link to="/contact">Contact Campus</Link>
            <a href="https://mentauraca.info/" target="_blank" rel="noreferrer">
              Official Site (mentauraca.info) ↗
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function PortalLayout({ title, links, children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="portal-shell">
      <aside className="sidebar">
        <Link to="/" className="brand compact">
          <span className="brand-mark logo-mark">
            <img src="/mentaura-logo.png" alt="Mentaura CA" className="brand-logo-img" />
          </span>
          <span className="brand-text">
            <strong>Mentaura CA</strong>
            <em>{title}</em>
          </span>
        </Link>
        <nav>
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end}>
              <span>{l.label}</span>
              {l.badge !== undefined && l.badge !== null && l.badge > 0 ? (
                <span className="nav-badge" title={`${l.badge} pending assignment`}>
                  {l.badge}
                </span>
              ) : null}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <p>{user?.name}</p>
          <button
            className="btn subtle"
            onClick={() => {
              logout();
              navigate('/');
            }}
          >
            Logout
          </button>
        </div>
      </aside>
      <div className="portal-main">
        <header className="portal-header">
          <h1>{title}</h1>
          <Link to="/papers" className="btn ghost">
            Paper library
          </Link>
        </header>
        <div className="portal-content">{children}</div>
      </div>
    </div>
  );
}
