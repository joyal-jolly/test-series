import { Link, useNavigate } from 'react-router-dom';
import { PublicLayout } from '../components/Layouts';

/**
 * Base Error Page layout with Mentaura brand styling,
 * dark mode support, helpful action buttons, and navigation links.
 */
export function ErrorPage({
  code,
  badgeText,
  title,
  description,
  suggestedAction,
  onRetry,
}) {
  const navigate = useNavigate();

  return (
    <PublicLayout>
      <section className="error-page-section">
        <div className="error-page-card">
          {/* Eyebrow Status Badge */}
          <div className="error-badge">
            <span className="error-badge-dot" aria-hidden="true" />
            <span>{badgeText || `Error ${code}`}</span>
          </div>

          {/* Large Decorative Code */}
          <div className="error-big-code" aria-hidden="true">
            {code}
          </div>

          {/* Main Error Heading & Description */}
          <h1 className="error-title">{title}</h1>
          <p className="error-desc">{description}</p>

          {suggestedAction && (
            <div className="error-hint-box">
              <span className="error-hint-icon">💡</span>
              <span>{suggestedAction}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="error-actions">
            <button
              type="button"
              className="btn ghost"
              onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
            >
              ← Go Back
            </button>

            {onRetry && (
              <button
                type="button"
                className="btn subtle"
                onClick={onRetry}
              >
                ↻ Try Again
              </button>
            )}

            <Link to="/" className="btn primary">
              Home Page
            </Link>
          </div>

          {/* Helpful Navigation Links */}
          <div className="error-quick-links">
            <span className="error-quick-title">Quick Links:</span>
            <div className="error-links-row">
              <Link to="/papers">Question Papers</Link>
              <span className="dot">•</span>
              <Link to="/login">Student / Faculty Login</Link>
              <span className="dot">•</span>
              <Link to="/about">About Campus</Link>
              <span className="dot">•</span>
              <Link to="/contact">Support &amp; Contact</Link>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

// ─── 404: Not Found ─────────────────────────────────────────────────────────
export function NotFoundPage() {
  return (
    <ErrorPage
      code="404"
      badgeText="Page Not Found"
      title="Looks like you're lost"
      description="The page you requested could not be found. It may have been moved, renamed, or is temporarily unavailable."
      suggestedAction="Check the URL for typos or browse our published question papers."
    />
  );
}

// ─── 403: Forbidden / Access Denied ─────────────────────────────────────────
export function ForbiddenPage() {
  return (
    <ErrorPage
      code="403"
      badgeText="Access Restricted"
      title="Access Denied"
      description="You do not have permission to view this resource. Please make sure you are signed in with the appropriate account (Admin, Reviewer, or Student)."
      suggestedAction="Try signing out and logging in with an authorized account."
    />
  );
}

// ─── 500: Internal Server Error ────────────────────────────────────────────
export function ServerErrorPage() {
  return (
    <ErrorPage
      code="500"
      badgeText="Internal Error"
      title="Something went wrong"
      description="An unexpected error occurred on our assessment servers. Our engineering team has been alerted and is looking into it."
      suggestedAction="Please try refreshing the page in a few moments."
      onRetry={() => window.location.reload()}
    />
  );
}

// ─── 502: Bad Gateway ──────────────────────────────────────────────────────
export function BadGatewayPage() {
  return (
    <ErrorPage
      code="502"
      badgeText="Bad Gateway"
      title="Connection Gateway Error"
      description="The server received an invalid response from an upstream provider or database while attempting to fulfill your request."
      suggestedAction="This is usually temporary. Please retry in a few seconds."
      onRetry={() => window.location.reload()}
    />
  );
}

// ─── 503: Service Unavailable / Maintenance ────────────────────────────────
export function ServiceUnavailablePage() {
  return (
    <ErrorPage
      code="503"
      badgeText="Service Unavailable"
      title="Under Maintenance"
      description="The Mentaura Assessment Portal is temporarily unavailable or undergoing scheduled updates. Services will resume shortly."
      suggestedAction="Check back in a few minutes or reach out to campus administration."
      onRetry={() => window.location.reload()}
    />
  );
}

// Default export
export default NotFoundPage;
