import { Link } from 'react-router-dom';
import { PublicLayout } from '../components/Layouts';
import CampusBuildingGrid from '../components/CampusBuildingGrid';

export default function HomePage() {
  return (
    <PublicLayout>
      <div className="home-canvas">
        {/* Eyebrow badge pill */}
        <div className="home-eyebrow-wrap">
          <div className="home-eyebrow-pill">
            <span>MENTAURA CA RESIDENTIAL CAMPUS</span>
            <span className="dot">•</span>
            <span>VAZHAKULAM, ERNAKULAM</span>
          </div>
        </div>

        {/* Main Hero grid */}
        <div className="home-hero-grid">
          {/* Left Column: Brand Copy & CTAs */}
          <div className="home-hero-content">
            <h1 className="hero-brand-name">Mentaura</h1>
            <div className="hero-brand-sub">CA Academy</div>
            <p className="hero-brand-tagline">Committed to Your Success</p>
            <p className="hero-brand-desc">
              Shaping India&apos;s finest Chartered Accountants through excellence, discipline,
              and care. Attempt structured test series for CA Intermediate &amp; CA Final,
              submit handwritten answer PDFs, and receive faculty evaluations with question-wise
              marks and actionable feedback.
            </p>
            <div className="home-cta-group">
              <Link to="/papers" className="btn-cta-primary">
                <span>Browse Question Papers</span>
                <span className="btn-arrow" aria-hidden="true">→</span>
              </Link>
              <Link to="/register" className="btn-cta-secondary">
                Student Registration
              </Link>
              <a
                href="https://mentauraca.info/"
                target="_blank"
                rel="noreferrer"
                className="btn-cta-campus"
              >
                <span>Explore Campus (mentauraca.info)</span>
                <span aria-hidden="true">↗</span>
              </a>
            </div>
          </div>

          {/* Right Column: Architectural Building Grid + Evaluation Workflow Card */}
          <div className="home-hero-panel">
            {/* Campus Building Architectural Grid */}
            <CampusBuildingGrid />

            {/* Evaluation Workflow Card */}
            <div className="eval-workflow-card">
              <div className="workflow-card-head">EVALUATION WORKFLOW</div>
              <ol className="workflow-card-list">
                <li>
                  <span className="workflow-step-num">01</span>
                  <span className="workflow-step-text">Browse published question papers</span>
                </li>
                <li>
                  <span className="workflow-step-num">02</span>
                  <span className="workflow-step-text">Attempt test &amp; upload handwritten PDF</span>
                </li>
                <li>
                  <span className="workflow-step-num">03</span>
                  <span className="workflow-step-text">Experienced faculty &amp; CA reviewer assigned</span>
                </li>
                <li>
                  <span className="workflow-step-num">04</span>
                  <span className="workflow-step-text">Detailed question-wise marks &amp; feedback</span>
                </li>
              </ol>
              <div className="workflow-card-foot">
                <span>Vazhakulam, Ernakulam</span>
                <span>+91 6282955052</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Feature Cards */}
        <section className="home-feature-deck" aria-label="Key features">
          <article className="home-feature-card">
            <div className="feature-card-icon" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
            </div>
            <h3 className="feature-card-title">Curated Papers</h3>
            <p className="feature-card-desc">Topic-wise &amp; Full-length question papers.</p>
          </article>

          <article className="home-feature-card">
            <div className="feature-card-icon" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
                <path d="M12 12v9" />
                <path d="m16 16-4-4-4 4" />
              </svg>
            </div>
            <h3 className="feature-card-title">Submit &amp; Evaluate</h3>
            <p className="feature-card-desc">Upload handwritten PDFs for expert evaluation.</p>
          </article>

          <article className="home-feature-card">
            <div className="feature-card-icon" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v18h18" />
                <path d="m19 9-5 5-4-4-3 3" />
              </svg>
            </div>
            <h3 className="feature-card-title">Detailed Feedback</h3>
            <p className="feature-card-desc">Question-wise marks &amp; actionable insights.</p>
          </article>

          <article className="home-feature-card">
            <div className="feature-card-icon" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <h3 className="feature-card-title">Expert Faculty</h3>
            <p className="feature-card-desc">Evaluations by experienced CA reviewers.</p>
          </article>
        </section>
      </div>
    </PublicLayout>
  );
}
