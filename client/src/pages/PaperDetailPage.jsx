import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PublicLayout } from '../components/Layouts';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

export default function PaperDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [paper, setPaper] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    api(`/api/papers/${id}`)
      .then((d) => setPaper(d.paper))
      .catch((e) => setError(e.message));
  }, [id]);

  function handleAttemptClick() {
    if (!user) {
      navigate(`/login?next=/papers/${id}`);
      return;
    }
    if (user.role !== 'student') {
      setError('Only students can attempt papers.');
      return;
    }
    setShowConfirm(true);
  }

  async function confirmAttempt() {
    setBusy(true);
    setError('');
    setShowConfirm(false);
    try {
      const data = await api('/api/student/start', {
        method: 'POST',
        body: { questionPaperId: id },
      });
      navigate(`/student/attempts/${data.attempt.id}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (error && !paper) {
    return (
      <PublicLayout>
        <section className="page-band">
          <p className="error">{error}</p>
        </section>
      </PublicLayout>
    );
  }

  if (!paper) {
    return (
      <PublicLayout>
        <section className="page-band">
          <p className="muted">Loading…</p>
        </section>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <section className="page-band">

        {/* ── Confirmation Modal ─────────────────────────────────────────── */}
        {showConfirm && (
          <div className="modal-overlay" onClick={() => setShowConfirm(false)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="modal-badge">📋 Confirm Attempt</div>
              <h2 className="modal-title">{paper.title}</h2>

              <div className="modal-paper-meta">
                <div className="modal-meta-item">
                  <span className="modal-meta-icon">🎓</span>
                  <div>
                    <strong>{paper.caLevel}</strong>
                    <span>{paper.paperType}</span>
                  </div>
                </div>
                <div className="modal-meta-item">
                  <span className="modal-meta-icon">📚</span>
                  <div>
                    <strong>{paper.subjectName}</strong>
                    <span>Subject</span>
                  </div>
                </div>
                <div className="modal-meta-item">
                  <span className="modal-meta-icon">⏱️</span>
                  <div>
                    <strong>{paper.durationMinutes} minutes</strong>
                    <span>Duration</span>
                  </div>
                </div>
                <div className="modal-meta-item">
                  <span className="modal-meta-icon">📝</span>
                  <div>
                    <strong>{paper.totalMarks} marks</strong>
                    <span>Total marks</span>
                  </div>
                </div>
              </div>

              <div className="modal-instructions">
                <h4>⚠️ Before you begin</h4>
                <ul>
                  <li>The timer starts immediately once you click <strong>Start Exam</strong>.</li>
                  <li>The question paper will be shown on screen — <strong>downloading is not allowed</strong>.</li>
                  <li>Write your answers on paper and upload a scan/photo at the end.</li>
                  <li>Once started, you cannot pause the exam.</li>
                </ul>
              </div>

              {error && <p className="error">{error}</p>}

              <div className="modal-actions">
                <button className="btn ghost" onClick={() => setShowConfirm(false)} disabled={busy}>
                  Cancel
                </button>
                <button className="btn primary lg" onClick={confirmAttempt} disabled={busy}>
                  {busy ? 'Starting…' : '🚀 Start Exam'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Paper Detail ───────────────────────────────────────────────── */}
        <div className="detail-layout-single">
          <div className="meta">
            <span>{paper.caLevel}</span>
            <span>{paper.paperType}</span>
            <span>{paper.subjectName}</span>
          </div>
          <h1>{paper.title}</h1>
          <p className="lede">{paper.description}</p>
          <div className="stat-row">
            <div>
              <strong>{paper.totalMarks}</strong>
              <span>Total marks</span>
            </div>
            <div>
              <strong>{paper.durationMinutes}</strong>
              <span>Minutes</span>
            </div>
          </div>
          {error && <p className="error">{error}</p>}
          <div className="cta-row">
            <button className="btn primary lg" onClick={handleAttemptClick} disabled={busy}>
              {busy ? 'Starting…' : 'Attempt this paper'}
            </button>
          </div>


        </div>
      </section>
    </PublicLayout>
  );
}
