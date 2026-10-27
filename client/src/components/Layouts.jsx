import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

function SunIcon() {
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
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
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
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

export function PublicLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

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
          <NavLink to="/contact">Contact &amp; Admissions</NavLink>
          <a href="https://mentauraca.info/" target="_blank" rel="noreferrer" className="nav-external">
            Official Website ↗
          </a>
        </nav>
        <div className="top-actions">
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label="Toggle dark mode"
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
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
            <p>Kadalikadu P.O., Manjalloor, Vazhakulam, Ernakulam, Kerala</p>
            <p>
              <a href="tel:+916282955052">+91 6282955052</a>
              <span className="bullet">·</span>
              <a href="mailto:mentauraca@gmail.com">mentauraca@gmail.com</a>
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
            <h4>Campus &amp; Info</h4>
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
  const { theme, toggleTheme } = useTheme();

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
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label="Toggle dark mode"
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
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
