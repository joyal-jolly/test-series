import { PublicLayout } from '../components/Layouts';

export default function AboutPage() {
  return (
    <PublicLayout>
      <section className="page-band">
        {/* Header Eyebrow & Titles */}
        <div className="papers-header" style={{ marginBottom: '2rem' }}>
          <div className="papers-eyebrow-pill">
            <span className="papers-eyebrow-dot" aria-hidden="true" />
            <span>MENTAURA CA RESIDENTIAL CAMPUS</span>
            <span className="dot">•</span>
            <span>VAZHAKULAM, ERNAKULAM</span>
          </div>

          <h1 className="papers-main-title">About Mentaura CA Campus</h1>
          <p className="papers-motto">COMMITTED TO YOUR SUCCESS</p>
        </div>

        {/* Hero Section: 2 Columns (Text + Campus Photo Card) */}
        <div className="about-hero-grid">
          <div className="about-hero-text">
            <p className="lede">
              Mentaura CA Residential Campus is an elite educational institution located in Vazhakulam,
              Ernakulam, Kerala. We are dedicated to shaping India&apos;s finest Chartered Accountants through
              an immersive residential learning environment combining academic rigor, discipline, and holistic care.
            </p>

            <div className="about-philosophy-card">
              <h3>The Mentaura Philosophy</h3>
              <p>
                We believe that a student&apos;s environment is the single most critical factor in clearing CA examinations.
                By providing a distraction-free campus in the calm surroundings of Kadalikadu, Manjalloor, we enable
                aspirants to sustain the focus, mental resilience, and consistent daily practice needed to master the ICAI syllabus.
              </p>
            </div>
          </div>

          <div className="about-campus-image-card">
            <img
              src="/campus-building.jpg"
              alt="Mentaura CA Residential Campus Building"
              className="about-campus-photo"
            />
            <div className="about-campus-caption">
              <strong>Mentaura Residential Campus</strong>
              <span>Kadalikadu P.O., Manjalloor, Vazhakulam, Ernakulam, Kerala</span>
            </div>
          </div>
        </div>

        {/* Campus Pillars */}
        <div className="about-section-head">
          <h2>Core Campus Pillars</h2>
          <p>Carefully engineered living and learning infrastructure designed for top CA ranks.</p>
        </div>

        <div className="about-grid">
          <div className="about-card">
            <h3>Structured Academics</h3>
            <p>
              A balanced daily schedule designed for maximum retention, intensive concept coverage, and continuous
              evaluation through regular question papers.
            </p>
          </div>
          <div className="about-card">
            <h3>1-on-1 Faculty Mentoring</h3>
            <p>
              Continuous doubt-clearing sessions,p and personalized guidance led by experienced
              Chartered Accountants and educators.
            </p>
          </div>
          <div className="about-card">
            <h3>Dedicated Infrastructure</h3>
            <p>
              Personal study cubicles, 24/7 silent study halls, high-speed digital archives, and premium living quarters
              with attached bathrooms.
            </p>
          </div>
          <div className="about-card">
            <h3>Holistic Wellness</h3>
            <p>
              Nutritious and hygienic food, designated relaxation &amp; recline spaces, and a supportive community
              of ambitious peers.
            </p>
          </div>
        </div>

        {/* Programs Offered */}
        <div className="about-section-head">
          <h2>Programs Offered</h2>
          <p>Comprehensive residential cohorts and exam-oriented online assessment test series.</p>
        </div>

        <div className="programs-grid">
          <div className="program-card">
            <div className="program-badge">Group 1 &amp; Group 2</div>
            <h3>CA Intermediate</h3>
            <p>
              Comprehensive residential batches with daily structured schedule, intensive chapter-wise tests, and faculty annotations.
            </p>
            <ul className="program-points">
              <li>Exhaustive ICAI syllabus coverage</li>
              <li>Daily scheduled test practice</li>
              <li>Handwritten evaluation &amp; scoring</li>
            </ul>
          </div>

          <div className="program-card featured">
            <div className="program-badge highlight">Advanced Batch</div>
            <h3>CA Final</h3>
            <p>
              Advanced level coaching, case-study drills, and intensive board-level simulated mock exams for both groups.
            </p>
            <ul className="program-points">
              <li>In-depth case-study methodology</li>
              <li>Simulated exam hall conditions</li>
              <li>Personalized faculty review feedback</li>
            </ul>
          </div>

          <div className="program-card">
            <div className="program-badge">High Yield</div>
            <h3>Crash Courses &amp; Test Series</h3>
            <p>
              Exam-oriented test series with handwritten answer evaluation, detailed question-wise scorecards, and faculty remarks.
            </p>
            <ul className="program-points">
              <li>Full syllabus simulated papers</li>
              <li>Detailed PDF annotations</li>
              <li>Actionable performance insights</li>
            </ul>
          </div>
        </div>


        {/* Official Website CTA Panel */}
        <div className="about-cta-panel">
          <div className="about-cta-text">
            <h3>Learn more on our official campus website</h3>
            <p>
              Explore our full campus galleries, batch schedules, admission criteria, and student testimonials
              on our official campus portal.
            </p>
          </div>
          <a
            href="https://mentauraca.info/"
            target="_blank"
            rel="noreferrer"
            className="btn primary lg"
            style={{ minWidth: 200, textAlign: 'center' }}
          >
            Visit mentauraca.info ↗
          </a>
        </div>
      </section>
    </PublicLayout>
  );
}
