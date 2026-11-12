import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ConfirmModal } from './ConfirmModal';

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function LogoutIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

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
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

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
            <img src="/mentaura-logo.png" alt="Mentaura" className="brand-logo-img" />
          </span>
          <span className="brand-text">
            <strong>Mentaura</strong>
            <em>Assessment Series</em>
          </span>
        </Link>
        <nav className="nav">
          <NavLink to="/" end>Home</NavLink>
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
              <button className="btn subtle" onClick={() => setShowLogoutConfirm(true)}>
                Logout
              </button>
            </>
          ) : (
            <>
              <Link className="nav-login-link" to="/login">
                Login
              </Link>
              <Link className="btn primary nav-register-btn" to="/register">
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
      <ConfirmModal
        isOpen={showLogoutConfirm}
        title="Confirm Logout"
        message="Are you sure you want to log out of your account?"
        confirmText="Logout"
        confirmVariant="primary"
        onConfirm={() => {
          setShowLogoutConfirm(false);
          logout();
          navigate('/');
        }}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </div>
  );
}

export function PortalLayout({ title, links, children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close mobile drawer on route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  // Handle ESC key to close drawer
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    function handleKeyDown(e) {
      if (e.key === 'Escape') setIsMobileMenuOpen(false);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileMenuOpen]);

  const totalBadges = links.reduce(
    (sum, l) => sum + (typeof l.badge === 'number' && l.badge > 0 ? l.badge : 0),
    0
  );

  return (
    <div className="portal-shell">
      {/* ── Mobile Top Header (only on screens <= 860px) ── */}
      <header className="portal-mobile-header">
        <Link to="/" className="portal-mobile-brand">
          <img src="/mentaura-logo.png" alt="Mentaura CA" className="portal-mobile-logo" />
          <div className="portal-mobile-title">
            <strong>Mentaura CA</strong>
            <em>{title}</em>
          </div>
        </Link>
        <div className="portal-mobile-actions">
          <button
            type="button"
            className="theme-toggle portal-mobile-theme-btn"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label="Toggle dark mode"
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
          <button
            type="button"
            className={`portal-menu-trigger ${isMobileMenuOpen ? 'active' : ''}`}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          >
            {isMobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
            <span>Menu</span>
            {totalBadges > 0 && <span className="nav-badge">{totalBadges}</span>}
          </button>
        </div>
      </header>

      {/* ── Mobile Drawer Backdrop ── */}
      {isMobileMenuOpen && (
        <div
          className="portal-mobile-backdrop"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar (Desktop standard / Mobile slide-out drawer) ── */}
      <aside className={`sidebar portal-sidebar ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="portal-sidebar-head">
          <Link to="/" className="brand compact" onClick={() => setIsMobileMenuOpen(false)}>
            <span className="brand-mark logo-mark">
              <img src="/mentaura-logo.png" alt="Mentaura CA" className="brand-logo-img" />
            </span>
            <span className="brand-text">
              <strong>Mentaura CA</strong>
              <em>{title}</em>
            </span>
          </Link>
          <button
            type="button"
            className="portal-mobile-close-btn"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label="Close menu"
          >
            <CloseIcon />
          </button>
        </div>

        {/* User Card in Menu tab */}
        <div className="portal-user-card">
          <div className="portal-user-avatar">
            {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="portal-user-details">
            <strong className="portal-user-name">{user?.name || 'User'}</strong>
            <div className="portal-user-meta">
              <span className="portal-role-pill">{user?.role || 'Portal'}</span>
              {user?.email && <span className="portal-user-email">{user.email}</span>}
            </div>
          </div>
          <button
            type="button"
            className="portal-user-card-logout"
            onClick={() => {
              setIsMobileMenuOpen(false);
              setShowLogoutConfirm(true);
            }}
            title="Log out"
            aria-label="Log out"
          >
            <LogoutIcon size={16} />
          </button>
        </div>

        <nav>
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <span>{l.label}</span>
              {l.badge !== undefined && l.badge !== null && l.badge > 0 ? (
                <span className="nav-badge" title={`${l.badge} pending`}>
                  {l.badge}
                </span>
              ) : null}
            </NavLink>
          ))}
          <Link
            to="/papers"
            className="portal-extra-nav-link"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <span>Question Paper Library ↗</span>
          </Link>
        </nav>

        <div className="sidebar-foot">
          <div className="sidebar-foot-actions">
            <button
              type="button"
              className="theme-toggle"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label="Toggle dark mode"
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
            <button
              type="button"
              className="btn subtle portal-logout-btn"
              onClick={() => {
                setIsMobileMenuOpen(false);
                setShowLogoutConfirm(true);
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
          <Link to="/papers" className="btn ghost portal-desktop-library-link">
            Paper library
          </Link>
        </header>
        <div className="portal-content">{children}</div>
      </div>

      <ConfirmModal
        isOpen={showLogoutConfirm}
        title="Confirm Logout"
        message="Are you sure you want to log out of the portal?"
        confirmText="Logout"
        confirmVariant="primary"
        onConfirm={() => {
          setShowLogoutConfirm(false);
          logout();
          navigate('/');
        }}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </div>
  );
}
