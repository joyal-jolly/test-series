import { PublicLayout } from '../components/Layouts';

export default function AboutPage() {
  return (
    <PublicLayout>
      <section className="page-band">
        <div className="narrow">
          <div className="about-header-badge">
            <img src="/mentaura-logo.png" alt="Mentaura CA" className="about-mini-logo" />
            <span>Residential Campus · Vazhakulam, Ernakulam</span>
          </div>

          <h1>About Mentaura CA</h1>
          <p className="hero-tagline">Committed to Your Success</p>

          <p className="lede">
            Mentaura CA Residential Campus is an elite educational institution located in Vazhakulam,
            Ernakulam, Kerala. We are dedicated to shaping India&apos;s finest Chartered Accountants through
            an immersive residential learning environment combining academic rigor, discipline, and holistic care.
          </p>

          <hr className="divider" />

          <h2>The Mentaura Philosophy</h2>
          <p>
            We believe that a student&apos;s environment is the single most critical factor in clearing CA examinations.
            By providing a distraction-free campus in the calm surroundings of Kadalikadu, Manjalloor, we enable
            aspirants to sustain the focus, mental resilience, and consistent daily practice needed to master the ICAI syllabus.
          </p>

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
                Continuous doubt-clearing sessions, psychological counseling, and personalized guidance led by experienced
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

          <h2>Programs Offered</h2>
          <ul className="plain-list">
            <li>
              <strong>CA Intermediate:</strong> Comprehensive residential batches for Group 1 and Group 2 with chapter-wise tests and evaluations.
            </li>
            <li>
              <strong>CA Final:</strong> Advanced level coaching, case-study drills, and intensive board-level simulated mock exams.
            </li>
            <li>
              <strong>Crash Courses &amp; Test Series:</strong> High-yield exam-oriented test series with handwritten answer evaluation and question-wise feedback.
            </li>
          </ul>

          <h2>Founding Leadership</h2>
          <p>
            Mentaura was founded by an enthusiastic team committed to raising the standard of CA education in Kerala:
          </p>
          <div className="founders-grid">
            <div className="founder-card">
              <strong>CA Jacobkutty Jaison</strong>
              <span>Co-Founder &amp; Mentor</span>
            </div>
            <div className="founder-card">
              <strong>John Joseph</strong>
              <span>Co-Founder</span>
            </div>
            <div className="founder-card">
              <strong>Iwin Johny</strong>
              <span>Co-Founder</span>
            </div>
          </div>

          <div className="panel about-cta-panel">
            <h3>Learn more on our official website</h3>
            <p>
              Explore our full campus galleries, batch schedules, admission criteria, and student testimonials
              on our official website.
            </p>
            <a
              href="https://mentauraca.info/"
              target="_blank"
              rel="noreferrer"
              className="btn primary"
            >
              Visit mentauraca.info ↗
            </a>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
