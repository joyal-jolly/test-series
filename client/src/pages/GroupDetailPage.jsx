import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { PublicLayout } from '../components/Layouts';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

// ─── localStorage helpers (same key as PapersPage) ───────────────────────────
const LS_KEY = 'mentaura_enrolled_groups';

function getEnrolled(userId) {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return data[userId] || [];
  } catch { return []; }
}
function saveEnrolled(userId, groupId) {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const data = raw ? JSON.parse(raw) : {};
    if (!data[userId]) data[userId] = [];
    if (!data[userId].includes(groupId)) data[userId].push(groupId);
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
}

function formatScheduleDateTime(iso) {
  if (!iso) return 'Immediately available';
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short', year: 'numeric', month: 'short',
    day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ─── Attempt Confirmation Modal ───────────────────────────────────────────────
function AttemptModal({ paper, onConfirm, onCancel, busy, error }) {
  return (
    <div className="modal-overlay" onClick={() => !busy && onCancel()}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-badge">Confirm Attempt</div>
        <h2 className="modal-title">{paper.title}</h2>
        <div className="modal-paper-meta">
          <div className="modal-meta-item">
            <span className="modal-meta-icon"></span>
            <div><strong>{paper.caLevel}</strong><span>{paper.paperType}</span></div>
          </div>
          <div className="modal-meta-item">
            <span className="modal-meta-icon"></span>
            <div><strong>{paper.subjectName}</strong><span>Subject</span></div>
          </div>
          <div className="modal-meta-item">
            <span className="modal-meta-icon"></span>
            <div><strong>{paper.durationMinutes} minutes</strong><span>Duration</span></div>
          </div>
          <div className="modal-meta-item">
            <span className="modal-meta-icon"></span>
            <div><strong>{paper.totalMarks} marks</strong><span>Total marks</span></div>
          </div>
        </div>
        <div className="modal-instructions">
          <h4>Before you begin</h4>
          <ul>
            <li>The timer starts immediately once you click <strong>Start Exam</strong>.</li>
            <li>The question paper will be displayed on screen — <strong>downloading is not allowed</strong>.</li>
            <li>Write your answers on physical paper and upload a scan/photo before the timer expires.</li>
            <li>Once started, you cannot pause the exam.</li>
          </ul>
        </div>
        {error && <p className="error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="btn primary lg" onClick={onConfirm} disabled={busy}>
            {busy ? 'Starting exam…' : 'Start Exam'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Per-paper action button ──────────────────────────────────────────────────
function PaperButton({ paperId, isAvailable, enrolled, paperAttempts, onAttemptClick, navigate }) {
  if (!isAvailable) {
    return (
      <button disabled style={{ fontSize: '0.82rem', padding: '0.4rem 0.9rem', background: '#f8fafc', border: '1px solid #cbd5e1', color: '#64748b', borderRadius: '8px', cursor: 'not-allowed', fontWeight: 600 }}>
        Locked
      </button>
    );
  }

  if (!enrolled) {
    // Not purchased — show nothing in this column (purchase is done on library page)
    return (
      <button disabled style={{ fontSize: '0.82rem', padding: '0.4rem 0.9rem', background: '#f8fafc', border: '1px solid #cbd5e1', color: '#94a3b8', borderRadius: '8px', cursor: 'not-allowed', fontWeight: 600 }}>
        Purchase first
      </button>
    );
  }

  const attempt = paperAttempts[paperId];

  if (!attempt) {
    // Enrolled, not attempted yet
    return (
      <button
        type="button"
        onClick={() => onAttemptClick(paperId)}
        style={{ fontSize: '0.88rem', padding: '0.45rem 1.1rem', background: '#14123a', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(79,70,229,0.3)' }}
      >
        Attempt Paper →
      </button>
    );
  }

  if (attempt.status === 'evaluated') {
    // Result is available
    return (
      <button
        type="button"
        onClick={() => navigate(`/student/attempts/${attempt.attemptId}/result`)}
        style={{ fontSize: '0.88rem', padding: '0.45rem 1.1rem', background: '#15803d', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(21,128,61,0.25)' }}
      >
        Check Result →
      </button>
    );
  }

  // Submitted / assigned / under_review → unclickable
  return (
    <button
      disabled
      style={{ fontSize: '0.82rem', padding: '0.45rem 1.1rem', background: '#fef3c7', color: '#92400e', border: '1.5px solid #fde68a', borderRadius: '8px', fontWeight: 700, cursor: 'not-allowed', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
    >
      ⏳ Under Review
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function GroupDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [enrolled, setEnrolled] = useState(false);
  const [paperAttempts, setPaperAttempts] = useState({}); // { paperId: { attemptId, status } }
  const [now, setNow] = useState(() => Date.now());

  // Attempt modal
  const [selectedPaperId, setSelectedPaperId] = useState(null);
  const [attemptBusy, setAttemptBusy] = useState(false);
  const [attemptError, setAttemptError] = useState('');

  // ── Fetch group ────────────────────────────────────────────────────────────
  useEffect(() => {
    api(`/api/papers/groups/${id}`)
      .then((d) => setGroup(d.group))
      .catch((err) => setError(err.message || 'Failed to load group details'))
      .finally(() => setLoading(false));
  }, [id]);

  // ── Tick clock every 5s (schedule unlock) ─────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  // ── Check enrollment ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || user.role !== 'student') return;
    // Instant check from localStorage
    if (getEnrolled(user.id).includes(id)) { setEnrolled(true); return; }
    // Server check
    api('/api/student/enrollments')
      .then((d) => {
        if ((d.enrolledGroupIds || []).includes(id)) {
          saveEnrolled(user.id, id);
          setEnrolled(true);
        }
      })
      .catch(() => {});
  }, [user, id]);

  // ── Fetch per-paper attempt statuses ──────────────────────────────────────
  const loadAttempts = useCallback(() => {
    if (!user || user.role !== 'student') return;
    api('/api/student/paper-attempts')
      .then((d) => setPaperAttempts(d.paperAttempts || {}))
      .catch(() => {});
  }, [user]);

  useEffect(() => { loadAttempts(); }, [loadAttempts]);

  // ── Attempt handlers ───────────────────────────────────────────────────────
  function handleAttemptClick(paperId) {
    if (!user) { navigate(`/login?next=/groups/${id}`); return; }
    setAttemptError('');
    setSelectedPaperId(paperId);
  }

  async function confirmAttempt() {
    if (!selectedPaperId) return;
    setAttemptBusy(true);
    setAttemptError('');
    try {
      const data = await api('/api/student/start', {
        method: 'POST',
        body: { questionPaperId: selectedPaperId },
      });
      navigate(`/student/attempts/${data.attempt.id}`);
    } catch (err) {
      setAttemptError(err.message);
      setAttemptBusy(false);
    }
  }

  const selectedPaper = group?.schedules?.flatMap((s) => s.papers || []).find((p) => p.id === selectedPaperId);
  const isStudent = user?.role === 'student';

  // ── Loading / Error ────────────────────────────────────────────────────────
  if (loading) return <PublicLayout><section className="page-band"><p className="muted">Loading group details…</p></section></PublicLayout>;
  if (error || !group) return (
    <PublicLayout>
      <section className="page-band">
        <p className="error">{error || 'Group not found'}</p>
        <Link to="/papers" className="btn ghost" style={{ marginTop: '1rem' }}>← Back to Library</Link>
      </section>
    </PublicLayout>
  );

  const expectedSubjects = group.numSubjectsPerSchedule || 3;

  return (
    <PublicLayout>
      <section className="page-band">

        {/* ── Attempt Modal ── */}
        {selectedPaperId && selectedPaper && (
          <AttemptModal
            paper={selectedPaper}
            onConfirm={confirmAttempt}
            onCancel={() => { setSelectedPaperId(null); setAttemptError(''); }}
            busy={attemptBusy}
            error={attemptError}
          />
        )}

        {/* ── Breadcrumb ── */}
        <div style={{ marginBottom: '1.25rem' }}>
          <Link to="/papers" style={{ color: '#4f46e5', fontWeight: 600, fontSize: '0.92rem', textDecoration: 'none' }}>
            ← Back to Question Paper Library
          </Link>
        </div>

        {/* ── Group Hero ── */}
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '2rem', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.25rem' }}>
            <div style={{ maxWidth: '750px' }}>
              <h1 style={{ margin: 0, fontSize: '2.1rem', fontWeight: 800, color: '#0a0a0a' }}>{group.name}</h1>
              <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#545363', marginTop: '0.4rem' }}>
                {group.numSchedules} Schedules · {expectedSubjects} Subjects per Schedule
              </div>
              {group.description && (
                <p className="muted" style={{ margin: '0.85rem 0 0', fontSize: '0.95rem', lineHeight: 1.6 }}>
                  {group.description}
                </p>
              )}
            </div>

            {/* Price + enrollment badge */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.65rem', minWidth: 160 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: 46, height: 46, borderRadius: '50%', background: '#f1f5f9', border: '1.5px solid #cbd5e1', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.74rem', fontWeight: 700, textDecoration: 'line-through', userSelect: 'none' }}>100 Rs</div>
                <div style={{ width: 60, height: 34, borderRadius: 999, background: '#dcfce7', border: '1.5px solid #86efac', color: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', userSelect: 'none' }}>Free</div>
              </div>
              {isStudent && enrolled && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#dcfce7', border: '1.5px solid #86efac', color: '#15803d', borderRadius: 999, padding: '0.4rem 1rem', fontWeight: 700, fontSize: '0.85rem' }}>
                  ✓ Enrolled
                </div>
              )}
              {isStudent && !enrolled && (
                <Link to="/papers" style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600, textDecoration: 'none' }}>
                  ← Purchase from library
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* ── Section Title ── */}
        <div style={{ marginBottom: '1.25rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.35rem', color: '#1e293b' }}>Schedules &amp; Question Papers</h2>
        </div>

        {error && <p className="error" style={{ marginBottom: '1rem' }}>{error}</p>}

        {/* ── Schedules ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {group.schedules.map((s) => {
            const papers = s.papers || [];
            const hasPapers = papers.length > 0;
            const isAvailable = s.isAvailable ?? (!s.availableAt || new Date(s.availableAt).getTime() <= now);

            if (hasPapers) {
              return (
                <div key={s.scheduleNumber} style={{ background: '#fff', border: '2px solid #6366f1', borderRadius: '14px', boxShadow: '0 8px 30px rgba(99,102,241,0.12)', overflow: 'hidden' }}>
                  {/* Header */}
                  <div style={{ padding: '1rem 1.5rem', background: 'linear-gradient(135deg,#eef2ff,#e0e7ff)', borderBottom: '2px solid #c7d2fe', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                      <span style={{ background: '#08071c', color: '#fff', fontWeight: 800, fontSize: '0.9rem', padding: '0.35rem 0.8rem', borderRadius: '8px' }}>
                        Schedule {s.scheduleNumber}
                      </span>
                      <div>
                        <strong style={{ fontSize: '1.05rem', color: '#1e1b4b' }}>
                          {papers.length} {papers.length === 1 ? 'Subject Question Paper' : 'Subject Question Papers'} Uploaded
                        </strong>
                        <span style={{ fontSize: '0.82rem', color: '#4338ca', display: 'block' }}>Target: {expectedSubjects} Subjects</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <span style={{ fontSize: '0.85rem', color: '#3730a3', fontWeight: 600 }}>Scheduled Access:</span>
                      {isAvailable ? (
                        <span className="pill published" style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', fontWeight: 700, fontSize: '0.82rem', padding: '0.35rem 0.75rem' }}>● Available Now</span>
                      ) : (
                        <span className="pill assigned" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', fontWeight: 700, fontSize: '0.82rem', padding: '0.35rem 0.75rem' }}>
                          🔒 Opens {formatScheduleDateTime(s.availableAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Papers table */}
                  <div style={{ padding: '1rem 1.5rem', overflowX: 'auto' }}>
                    <table className="data-table" style={{ background: '#fff', width: '100%' }}>
                      <tbody>
                        {papers.map((p) => (
                          <tr key={p.id}>
                            <td>
                              <strong style={{ fontSize: '0.98rem', color: '#0f172a' }}>{p.subjectName}</strong>
                              <div className="muted" style={{ fontSize: '0.78rem' }}>{p.caLevel}</div>
                            </td>
                            <td>
                              <Link to={`/papers/${p.id}`} style={{ fontWeight: 600, color: '#1e293b', textDecoration: 'none' }}
                                onMouseEnter={(e) => { e.currentTarget.style.color = '#4f46e5'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.color = '#1e293b'; }}>
                                {p.title}
                              </Link>
                              {p.chapter && <div className="muted" style={{ fontSize: '0.78rem' }}>{p.chapter}</div>}
                            </td>
                            <td>
                              <span className="pill" style={{ background: '#ede9fe', color: '#000', fontWeight: 600, fontSize: '0.75rem', border: '1px solid #ddd6fe' }}>{p.paperType}</span>
                            </td>
                            <td>
                              <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#334155' }}>
                                {p.totalMarks} marks · {p.durationMinutes} min
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {isStudent ? (
                                <PaperButton
                                  paperId={p.id}
                                  isAvailable={isAvailable}
                                  enrolled={enrolled}
                                  paperAttempts={paperAttempts}
                                  onAttemptClick={handleAttemptClick}
                                  navigate={navigate}
                                />
                              ) : !user ? (
                                <button
                                  type="button"
                                  onClick={() => navigate(`/login?next=/groups/${id}`)}
                                  style={{ fontSize: '0.85rem', padding: '0.4rem 1rem', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
                                >
                                  Login to Attempt
                                </button>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            }

            // No papers yet — dim card
            return (
              <div key={s.scheduleNumber} style={{ border: '1px dashed #cbd5e1', borderRadius: '14px', background: '#f8fafc', opacity: 0.55, pointerEvents: 'none', userSelect: 'none', filter: 'grayscale(80%)', overflow: 'hidden' }}>
                <div style={{ padding: '0.85rem 1.5rem', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ background: '#cbd5e1', color: '#475569', fontWeight: 700, fontSize: '0.82rem', padding: '0.25rem 0.6rem', borderRadius: '6px' }}>Schedule {s.scheduleNumber}</span>
                    <strong style={{ fontSize: '0.92rem', color: '#64748b' }}>Pending Admin Upload</strong>
                  </div>
                  <span className="pill" style={{ background: '#e2e8f0', color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>🔒 Unreleased</span>
                </div>
                <div style={{ padding: '1.25rem 1.5rem', textAlign: 'center', color: '#94a3b8' }}>
                  <p style={{ margin: 0, fontSize: '0.92rem', fontWeight: 500 }}>
                    Question papers for Schedule {s.scheduleNumber} have not been uploaded yet.
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </PublicLayout>
  );
}
