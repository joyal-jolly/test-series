import { Link } from 'react-router-dom';
import { PublicLayout } from '../components/Layouts';

export default function HomePage() {
  return (
    <PublicLayout>
      <section className="hero">
        <div className="hero-copy">
          <div className="hero-logo-box">
            <img
              src="/mentaura-logo.png"
              alt="Mentaura CA Residential Campus"
              className="hero-logo-img"
            />
          </div>
          <p className="eyebrow">Mentaura CA Residential Campus · Vazhakulam, Ernakulam</p>
          <h1 className="hero-brand">CA Academy</h1>
          <p className="hero-tagline">Committed to Your Success</p>
          <p className="lede">
            Shaping India&apos;s finest Chartered Accountants through excellence, discipline, and care.
            Attempt structured test series for CA Intermediate &amp; CA Final, submit handwritten answer PDFs,
            and receive faculty evaluations with question-wise marks and actionable feedback.
          </p>
          <div className="cta-row">
            <Link className="btn primary lg" to="/papers">
              Browse Question Papers
            </Link>
            <Link className="btn ghost lg" to="/register">
              Student Registration
            </Link>
            <a
              className="btn subtle lg"
              href="https://mentauraca.info/"
              target="_blank"
              rel="noreferrer"
            >
              Explore Campus (mentauraca.info) ↗
            </a>
          </div>
        </div>
        <div className="hero-panel" aria-hidden="true">
          <div className="hero-card">
            <span className="card-badge">Evaluation Workflow</span>
            <ol>
              <li>Browse published question papers</li>
              <li>Attempt test &amp; upload handwritten PDF</li>
              <li>Experienced faculty &amp; CA reviewer assigned</li>
              <li>Detailed question-wise marks &amp; feedback</li>
            </ol>
            <div className="hero-card-footer">
              <small>📍 Vazhakulam, Ernakulam · 📞 +91 6282955052</small>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Mentaura CA Learning Programs</h2>
          <p>
            An intensive residential learning ecosystem tailored for CA aspirants at every stage.
          </p>
        </div>
        <div className="programs-grid">
          <article className="program-card">
            <div className="program-badge">Foundation to Inter</div>
            <h3>CA Intermediate</h3>
            <p>
              In-depth coverage for Group 1 and Group 2 subjects. Complete chapter tests, revision series,
              and mock examinations with individual faculty feedback.
            </p>
            <ul className="program-points">
              <li>Corporate &amp; Advanced Accounting</li>
              <li>Direct &amp; Indirect Taxation</li>
              <li>Cost &amp; Management Accounting</li>
            </ul>
          </article>
          <article className="program-card featured">
            <div className="program-badge highlight">Advanced Level</div>
            <h3>CA Final</h3>
            <p>
              Rigorous preparation for India&apos;s most demanding professional qualification. Focused
              on case-study analysis, standards on auditing, and financial management.
            </p>
            <ul className="program-points">
              <li>Advanced Auditing &amp; Professional Ethics</li>
              <li>Financial Management &amp; Capital Markets</li>
              <li>Comprehensive Mock Board Exams</li>
            </ul>
          </article>
          <article className="program-card">
            <div className="program-badge">Intensive Prep</div>
            <h3>Crash Courses &amp; Test Series</h3>
            <p>
              High-yield revision sessions, speed-writing drills, and full-length simulated test papers
              evaluated by qualified Chartered Accountants before ICAI examinations.
            </p>
            <ul className="program-points">
              <li>Timed handwritten simulation</li>
              <li>Question-by-question marks breakdown</li>
              <li>Immediate weak-area identification</li>
            </ul>
          </article>
        </div>
      </section>

      <section className="section campus-highlights-section">
        <div className="section-head">
          <h2>The Mentaura Residential Experience</h2>
          <p>
            A dedicated ecosystem in Kadalikadu, Vazhakulam designed to eliminate distractions and foster deep focus.
          </p>
        </div>
        <div className="feature-grid">
          <article>
            <div className="feature-icon">🏛️</div>
            <h3>Residential Campus</h3>
            <p>
              Peaceful, distraction-free environment in Vazhakulam, Ernakulam featuring premium hostels with
              attached bathrooms, 24/7 security, and hygienic, nutritious dining.
            </p>
          </article>
          <article>
            <div className="feature-icon">📚</div>
            <h3>Dedicated Study Cubicles</h3>
            <p>
              Personal study cubicles, silent 24/7 study zones, and high-speed digital connectivity to support
              intensive study routines and uninterrupted concentration.
            </p>
          </article>
          <article>
            <div className="feature-icon">👨‍🏫</div>
            <h3>Personalized Mentorship</h3>
            <p>
              Continuous one-on-one sessions for doubt clearing, performance tracking, and psychological counseling
              guided by CA Jacobkutty Jaison and the co-founding leadership team.
            </p>
          </article>
        </div>
        <div className="campus-banner">
          <div>
            <h3>Want to join the residential campus in Vazhakulam, Ernakulam?</h3>
            <p>Call our admissions office at +91 6282955052 or visit mentauraca.info for campus tour details.</p>
          </div>
          <a
            href="https://mentauraca.info/"
            target="_blank"
            rel="noreferrer"
            className="btn primary lg"
          >
            Visit mentauraca.info ↗
          </a>
        </div>
      </section>
    </PublicLayout>
  );
}
