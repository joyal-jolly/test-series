import { useState } from 'react';
import { PublicLayout } from '../components/Layouts';
import { api } from '../lib/api';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    setStatus(null);
    try {
      const res = await api('/api/contact', { method: 'POST', body: form });
      setStatus(res.message);
      setForm({ name: '', email: '', subject: '', message: '' });
    } catch (err) {
      setError(err.message);
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
                <span className="contact-icon"></span>
                <div>
                  <strong>Campus Location</strong>
                  <p>Kadalikadu P.O., Manjalloor, Vazhakulam, Ernakulam, Kerala</p>
                </div>
              </div>

              <div className="contact-card">
                <span className="contact-icon"></span>
                <div>
                  <strong>Phone / WhatsApp</strong>
                  <p>
                    <a href="tel:+916282955052">+91 6282955052</a>
                  </p>
                </div>
              </div>

              <div className="contact-card">
                <span className="contact-icon"></span>
                <div>
                  <strong>Email</strong>
                  <p>
                    <a href="mailto:mentauraca@gmail.com">mentauraca@gmail.com</a>
                  </p>
                </div>
              </div>

              <div className="contact-card">
                <span className="contact-icon"></span>
                <div>
                  <strong>Major Website</strong>
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
            <button className="btn primary" type="submit">
              Send message
            </button>
          </form>
        </div>
      </section>
    </PublicLayout>
  );
}
