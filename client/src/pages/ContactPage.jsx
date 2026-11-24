import { PublicLayout } from '../components/Layouts';

function LocationIcon({ size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function PhoneIcon({ size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function WhatsAppIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm.01 1.67c2.2 0 4.26.86 5.82 2.42a8.23 8.23 0 0 1 2.41 5.82c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24zm4.52 11.64c-.25-.13-1.47-.72-1.7-.81-.23-.08-.4-.13-.56.13-.17.25-.65.81-.8 1-.14.16-.29.18-.54.06-.25-.13-1.07-.39-2.03-1.25-.75-.67-1.26-1.5-1.41-1.75-.15-.25-.02-.39.11-.51.11-.11.25-.29.38-.44.12-.14.17-.24.25-.4.08-.17.04-.31-.02-.44-.06-.12-.56-1.35-.77-1.85-.2-.49-.41-.42-.56-.43h-.48c-.16 0-.43.06-.65.31-.23.25-.87.85-.87 2.07s.89 2.4 1.02 2.57c.12.17 1.75 2.67 4.24 3.75.59.26 1.05.41 1.41.53.59.19 1.14.16 1.57.1.48-.07 1.47-.6 1.68-1.18.2-.58.2-1.08.14-1.18-.06-.1-.23-.17-.48-.29z" />
    </svg>
  );
}

function MailIcon({ size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

export default function ContactPage() {
  return (
    <PublicLayout>
      <section className="page-band">
        <div style={{ maxWidth: '720px', margin: '0 auto 2.5rem', textAlign: 'center' }}>
          <h1 style={{ marginBottom: '0.5rem' }}>Ways to Connect with Us</h1>
          <p className="hero-tagline" style={{ marginBottom: '0.75rem' }}>We&apos;re here to help you succeed</p>
          <p style={{ color: 'var(--ink-soft)', lineHeight: 1.6 }}>
            Have questions regarding admissions, residential batches, syllabus, or test series evaluations?
            Connect directly with our team through any of the channels below.
          </p>
        </div>

        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          <div className="contact-info-cards" style={{ marginTop: 0 }}>
            {/* Phone / WhatsApp - Preferred Mode */}
            <div className="contact-card preferred">
              <span className="contact-icon preferred-icon" title="Phone / WhatsApp">
                <PhoneIcon />
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                  <strong>Phone / WhatsApp</strong>
                  <span className="contact-preferred-tag">
                    ★ Preferred Mode
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                  <a href="tel:+916282955052" style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                    +91 6282955052
                  </a>
                  <a
                    href="https://wa.me/916282955052"
                    target="_blank"
                    rel="noreferrer"
                    className="contact-whatsapp-btn"
                  >
                    <WhatsAppIcon size={16} />
                    <span>Chat on WhatsApp</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Email */}
            <div className="contact-card">
              <span className="contact-icon" title="Email">
                <MailIcon />
              </span>
              <div>
                <strong>Email</strong>
                <p>
                  <a href="mailto:mentauraca@gmail.com">mentauraca@gmail.com</a>
                </p>
              </div>
            </div>

            {/* Campus Location */}
            <div className="contact-card">
              <span className="contact-icon" title="Location">
                <LocationIcon />
              </span>
              <div>
                <strong>Campus Location</strong>
                <p>Kadalikadu P.O., Manjalloor, Ernakulam, Kerala</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
