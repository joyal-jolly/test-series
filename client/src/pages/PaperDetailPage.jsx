import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { PublicLayout } from '../components/Layouts';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const LS_EXEMPTIONS_KEY = 'mentaura_subject_exemptions';
function getExemptions(userId, groupId) {
  try {
    const raw = localStorage.getItem(LS_EXEMPTIONS_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return (data[userId] && data[userId][groupId]) || [];
  } catch { return []; }
}

export default function PaperDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [paper, setPaper] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  function fetchPaper() {
    api(`/api/papers/${id}`)
      .then((d) => {
        setPaper(d.paper);
      })
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    fetchPaper();
  }, [id]);

  // Keep current time updated every 5 seconds to automatically unlock paper when scheduled time passes
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const isScheduled = Boolean(paper?.availableAt);
  const availableTimestamp = paper?.availableAt ? new Date(paper.availableAt).getTime() : 0;
  const isAvailable = !isScheduled || now >= availableTimestamp;

  const isExempted = Boolean(
    user &&
    paper?.groupId &&
    paper?.subjectId &&
    getExemptions(user.id, paper.groupId).includes(paper.subjectId)
  );

  // Auto-refetch when scheduled time is reached to obtain the full paper with pdfUrl
  useEffect(() => {
    if (paper && isScheduled && !paper.isAvailable && now >= availableTimestamp) {
      fetchPaper();
    }
  }, [now, availableTimestamp, isScheduled, paper]);

  function handleAttemptClick() {
    if (isExempted) {
      return;
    }
    if (!isAvailable) {
      setError(`This question paper is scheduled and will open on ${formatDateTime(paper.availableAt)}.`);
      return;
    }
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
          <div style={{ marginTop: '1rem' }}>
            <Link to="/papers" className="btn ghost">← Back to question papers</Link>
          </div>
        </section>
      </PublicLayout>
    );
  }

  if (!paper) {
    return (
      <PublicLayout>
        <section className="page-band">
          <p className="muted">Loading paper details…</p>
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
              <div className="modal-badge">Confirm Attempt</div>
              <h2 className="modal-title">{paper.title}</h2>

              <div className="modal-paper-meta">
                <div className="modal-meta-item">
                  <span className="modal-meta-icon"></span>
                  <div>
                    <strong>{paper.caLevel}</strong>
                    <span>{paper.paperType}</span>
                  </div>
                </div>
                <div className="modal-meta-item">
                  <span className="modal-meta-icon"></span>
                  <div>
                    <strong>{paper.subjectName}</strong>
                    <span>Subject</span>
                  </div>
                </div>
                <div className="modal-meta-item">
                  <span className="modal-meta-icon"></span>
                  <div>
                    <strong>{paper.durationMinutes} minutes</strong>
                    <span>Duration</span>
                  </div>
                </div>
                <div className="modal-meta-item">
                  <span className="modal-meta-icon"></span>
                  <div>
                    <strong>{paper.totalMarks} marks</strong>
                    <span>Total marks</span>
                  </div>
                </div>
              </div>

              <div className="modal-instructions">
                <h4>Before you begin</h4>
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
                  {busy ? 'Starting…' : 'Start Exam'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Breadcrumb / Group navigation ───────────────────────────────── */}
        <div style={{ marginBottom: '1.25rem' }}>
          <Link to="/papers" className="muted" style={{ fontSize: '0.9rem', textDecoration: 'none' }}>
            ← All Question Papers
          </Link>
          {paper.groupId && paper.groupName && (
            <Link to={`/groups/${paper.groupId}`} style={{ fontSize: '0.9rem', marginLeft: '0.5rem', color: '#4f46e5', textDecoration: 'none', fontWeight: 600 }}>
              / {paper.groupName} {paper.scheduleNumber ? `· Schedule ${paper.scheduleNumber}` : ''}
            </Link>
          )}
          {!paper.groupId && paper.groupName && (
            <span className="muted" style={{ fontSize: '0.9rem', marginLeft: '0.5rem' }}>
              / {paper.groupName} {paper.scheduleNumber ? `· Schedule ${paper.scheduleNumber}` : ''}
            </span>
          )}
        </div>

        {/* ── Paper Detail ───────────────────────────────────────────────── */}
        <div className="detail-layout-single">
          <div className="meta" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span>{paper.caLevel}</span>
            <span>Subject Type: {paper.paperType}</span>
            <span>{paper.subjectName}</span>
            {paper.scheduleNumber && (
              <span className="pill info" style={{ alignSelf: 'center' }}>
                Schedule {paper.scheduleNumber}
              </span>
            )}
          </div>

          <h1>{paper.title}</h1>
          {paper.groupName && (
            <p style={{ color: '#4f46e5', fontWeight: 600, margin: '0.25rem 0 0.5rem' }}>
              Part of {paper.groupName}
            </p>
          )}
          {paper.description && <p className="lede">{paper.description}</p>}

          <div className="stat-row">
            <div>
              <strong>{paper.totalMarks}</strong>
              <span>Total marks</span>
            </div>
            <div>
              <strong>{paper.durationMinutes}</strong>
              <span>Minutes</span>
            </div>
            {isScheduled && (
              <div>
                <strong style={{ fontSize: '1rem', color: isAvailable ? '#15803d' : '#b45309' }}>
                  {isAvailable ? 'Open' : formatDateTime(paper.availableAt)}
                </strong>
                <span>{isAvailable ? 'Availability' : 'Scheduled Open Time'}</span>
              </div>
            )}
          </div>

          {/* ── Exemption Notice ── */}
          {isExempted && (
            <div
              className="panel"
              style={{
                background: '#f5f3ff',
                border: '1px solid #c7d2fe',
                borderRadius: '12px',
                padding: '1.25rem',
                margin: '1.5rem 0',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
              }}
            >
              <div>
                <strong style={{ color: '#4338ca', fontSize: '1.05rem', display: 'block' }}>
                  Subject Marked as Exempted
                </strong>
                <p style={{ margin: '0.25rem 0 0', color: '#6366f1', fontSize: '0.9rem' }}>
                  You have marked this subject as an exemption in your group. You are not required to attempt this paper.
                </p>
              </div>
            </div>
          )}

          {/* ── Scheduled Access Notice ── */}
          {!isExempted && !isAvailable && (
            <div
              className="panel"
              style={{
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: '12px',
                padding: '1.25rem',
                margin: '1.5rem 0',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
              }}
            >
              <div style={{ fontSize: '2rem' }}>🔒</div>
              <div>
                <strong style={{ color: '#92400e', fontSize: '1.05rem', display: 'block' }}>
                  Paper Scheduled &ndash; Access Locked
                </strong>
                <p style={{ margin: '0.25rem 0 0', color: '#b45309', fontSize: '0.9rem' }}>
                  This question paper is scheduled and will automatically become available on{' '}
                  <strong>{formatDateTime(paper.availableAt)}</strong>. You cannot open, view, or attempt it before this time.
                </p>
              </div>
            </div>
          )}

          {error && <p className="error">{error}</p>}

          <div className="cta-row" style={{ marginTop: '1.5rem' }}>
            {isExempted ? (
              <button
                className="btn ghost lg"
                disabled
                style={{
                  opacity: 0.85,
                  cursor: 'default',
                  border: '1.5px solid #cbd5e1',
                  background: '#f1f5f9',
                  color: '#475569',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                Exemption &ndash; Not Required
              </button>
            ) : isAvailable ? (
              <button className="btn primary lg" onClick={handleAttemptClick} disabled={busy}>
                {busy ? 'Starting…' : 'Attempt this paper'}
              </button>
            ) : (
              <button
                className="btn ghost lg"
                disabled
                style={{
                  opacity: 0.7,
                  cursor: 'not-allowed',
                  border: '1px solid #d1d5db',
                  background: '#f3f4f6',
                  color: '#4b5563',
                }}
              >
                🔒 Available on {formatDateTime(paper.availableAt)}
              </button>
            )}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
