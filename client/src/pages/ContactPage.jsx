import { useState } from 'react';
import { PublicLayout } from '../components/Layouts';
import { api } from '../lib/api';

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

function GlobeIcon({ size = 20 }) {
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
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  );
}

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setStatus(null);
    setLoading(true);
    try {
      const res = await api('/api/contact', { method: 'POST', body: form });
      setStatus(res.message);
      setForm({ name: '', email: '', subject: '', message: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <PublicLayout>
      <section className="page-band">
        <div className="split">
          <div>
            <h1>Contact Mentaura CA</h1>
            <p className="hero-tagline">Committed to Your Success</p>
            <p>
              Have questions regarding admissions, residential batches, or online test series evaluations?
              Reach out directly to our campus administrative office in Vazhakulam, Ernakulam.
            </p>

            <div className="contact-info-cards">
              <div className="contact-card">
                <span className="contact-icon" title="Location">
                  <LocationIcon />
                </span>
                <div>
                  <strong>Campus Location</strong>
                  <p>Kadalikadu P.O., Manjalloor, Ernakulam, Kerala</p>
                </div>
              </div>

              <div className="contact-card">
                <span className="contact-icon" title="Phone">
                  <PhoneIcon />
                </span>
                <div>
                  <strong>Phone / WhatsApp</strong>
                  <p>
                    <a href="tel:+916282955052">+91 6282955052</a>
                  </p>
                </div>
              </div>

              <div className="contact-card">
                <span className="contact-icon" title="Email">
                  <MailIcon />
                </span>
                <div>
                  <strong>Email</strong>
                  <p>
                    <a href="mailto:mentauraca.testseries@gmail.com">mentauraca.testseries@gmail.com</a>
                  </p>
                </div>
              </div>

              <div className="contact-card">
                <span className="contact-icon" title="Website">
                  <GlobeIcon />
                </span>
                <div>
                  <strong>Official Website</strong>
                  <p>
                    <a href="https://mentauraca.info/" target="_blank" rel="noreferrer">
                      mentauraca.info ↗
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </div>
          <form className="panel form" onSubmit={submit}>
            <label>
              Name
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </label>
            <label>
              Email
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </label>
            <label>
              Subject
              <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            </label>
            <label>
              Message
              <textarea
                rows={5}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                required
              />
            </label>
            {error && <p className="error">{error}</p>}
            {status && <p className="success">{status}</p>}
            <button className="btn primary" type="submit" disabled={loading}>
              {loading ? 'Sending message…' : 'Send message'}
            </button>
          </form>
        </div>
      </section>
    </PublicLayout>
  );
}
