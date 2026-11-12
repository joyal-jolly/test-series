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

function UserDetailsIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
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

/**
 * User Details + Change Password Modal
 * Shown when the user clicks the profile icon in the sidebar user card.
 */
function UserDetailsModal({ user, onClose }) {
  // Steps: 'details' | 'otp-sent' | 'set-password' | 'done'
  const [step, setStep] = useState('details');
  const [otpToken, setOtpToken] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  function getToken() {
    return localStorage.getItem('ca_token') || '';
  }

  async function sendOtp() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/send-change-password-otp', {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send OTP');
      setOtpToken(data.otpToken);
      setStep('otp-sent');
      setMsg(`A 4-digit code was sent to ${user.email}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtpAndProceed() {
    if (!otp.trim()) { setError('Please enter the verification code.'); return; }
    setStep('set-password');
    setError('');
  }

  async function savePassword() {
    setError('');
    if (newPassword.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ otp: otp.trim(), otpToken, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to change password');
      setStep('done');
      setMsg('Password changed successfully!');
    } catch (e) {
      setError(e.message);
      // If OTP error, go back to OTP step
      if (e.message.toLowerCase().includes('otp') || e.message.toLowerCase().includes('code')) {
        setStep('otp-sent');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop user-details-modal-backdrop" onClick={onClose}>
      <div className="modal-card user-details-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-head user-details-modal-head">
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>
            {step === 'details' ? 'My Account' :
             step === 'otp-sent' ? 'Enter Verification Code' :
             step === 'set-password' ? 'Set New Password' : 'Success'}
          </h3>
          <button type="button" className="btn subtle" onClick={onClose} style={{ padding: '0.3rem 0.6rem', borderRadius: '50%' }}>✕</button>
        </div>

        <div className="user-details-modal-body">
          {/* ── DETAILS STEP ── */}
          {step === 'details' && (
            <>
              <div className="user-details-avatar-row">
                <div className="user-details-avatar">
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div>
                  <div className="user-details-name">{user?.name}</div>
                  <span className="portal-role-pill" style={{ textTransform: 'uppercase', fontSize: '0.72rem' }}>{user?.role}</span>
                </div>
              </div>
              <div className="user-details-fields">
                <div className="user-details-field">
                  <span className="user-details-label">Email</span>
                  <span className="user-details-value">{user?.email}</span>
                </div>
                {user?.profile?.caLevel && (
                  <div className="user-details-field">
                    <span className="user-details-label">CA Level</span>
                    <span className="user-details-value">{user.profile.caLevel}</span>
                  </div>
                )}
                {user?.profile?.phone && (
                  <div className="user-details-field">
                    <span className="user-details-label">Phone</span>
                    <span className="user-details-value">{user.profile.phone}</span>
                  </div>
                )}
              </div>
              {error && <div className="form-error" style={{ marginTop: '0.5rem' }}>{error}</div>}
              <div className="user-details-actions">
                <button type="button" className="btn primary" onClick={sendOtp} disabled={loading}>
                  {loading ? 'Sending…' : 'Change Password'}
                </button>
              </div>
            </>
          )}

          {/* ── OTP STEP ── */}
          {step === 'otp-sent' && (
            <>
              <p className="user-details-hint">{msg}</p>
              <label className="form-label">Verification Code</label>
              <input
                className="form-input"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="Enter 4-digit code"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                autoFocus
              />
              {error && <div className="form-error">{error}</div>}
              <div className="user-details-actions">
                <button type="button" className="btn subtle" onClick={() => setStep('details')}>Back</button>
                <button type="button" className="btn primary" onClick={verifyOtpAndProceed} disabled={!otp.trim()}>
                  Verify Code
                </button>
              </div>
              <div className="user-details-resend">
                Didn&apos;t receive the code?{' '}
                <button type="button" className="link-btn" onClick={sendOtp} disabled={loading}>
                  {loading ? 'Sending…' : 'Resend'}
                </button>
              </div>
            </>
          )}

          {/* ── SET PASSWORD STEP ── */}
          {step === 'set-password' && (
            <>
              <p className="user-details-hint">Create a new password for your account.</p>
              <label className="form-label">New Password</label>
              <input
                className="form-input"
                type="password"
                placeholder="Min. 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoFocus
              />
              <label className="form-label" style={{ marginTop: '0.75rem' }}>Confirm Password</label>
              <input
                className="form-input"
                type="password"
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              {error && <div className="form-error">{error}</div>}
              <div className="user-details-actions">
                <button type="button" className="btn subtle" onClick={() => setStep('otp-sent')}>Back</button>
                <button type="button" className="btn primary" onClick={savePassword} disabled={loading}>
                  {loading ? 'Saving…' : 'Save Password'}
                </button>
              </div>
            </>
          )}

          {/* ── DONE STEP ── */}
          {step === 'done' && (
            <>
              <div className="user-details-success">
                <span className="user-details-success-icon">✓</span>
                <p>{msg}</p>
              </div>
              <div className="user-details-actions">
                <button type="button" className="btn primary" onClick={onClose}>Close</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
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
  const [showUserDetails, setShowUserDetails] = useState(false);

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

        {/* User Card — shows name + role, details icon button */}
        <div className="portal-user-card">
          <div className="portal-user-avatar">
            {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="portal-user-details">
            <strong className="portal-user-name">{user?.name || 'User'}</strong>
            <div className="portal-user-meta">
              <span className="portal-role-pill">{user?.role || 'Portal'}</span>
            </div>
          </div>
          <button
            type="button"
            className="portal-user-card-logout"
            onClick={() => {
              setIsMobileMenuOpen(false);
              setShowUserDetails(true);
            }}
            title="View my details"
            aria-label="View account details"
          >
            <UserDetailsIcon size={16} />
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

      {showUserDetails && (
        <UserDetailsModal user={user} onClose={() => setShowUserDetails(false)} />
      )}
    </div>
  );
}
