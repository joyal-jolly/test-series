import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { PublicLayout } from '../components/Layouts';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

function formatScheduleDateTime(iso) {
  if (!iso) return 'Immediately available';
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

export default function GroupDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Attempt modal state (same workflow as previous paper submission execution)
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [busy, setBusy] = useState(false);
  const [attemptError, setAttemptError] = useState('');
  const [now, setNow] = useState(() => Date.now());

  function fetchGroup() {
    api(`/api/papers/groups/${id}`)
      .then((d) => {
        setGroup(d.group);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load group details');
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchGroup();
  }, [id]);

  // Keep time updated every 5s to unlock scheduled papers automatically
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  function handleAttemptClick(paper, schedule) {
    const isAvailable = schedule.isAvailable ?? (!schedule.availableAt || new Date(schedule.availableAt).getTime() <= now);
    if (!isAvailable) {
      setError(`This schedule is locked until ${formatScheduleDateTime(schedule.availableAt)}.`);
      return;
    }
    if (!user) {
      navigate(`/login?next=/groups/${id}`);
      return;
    }
    if (user.role !== 'student') {
      setError('Only students can attempt papers.');
      return;
    }
    setAttemptError('');
    setSelectedPaper(paper);
  }

  async function confirmAttempt() {
    if (!selectedPaper) return;
    setBusy(true);
    setAttemptError('');
    try {
      const data = await api('/api/student/start', {
        method: 'POST',
        body: { questionPaperId: selectedPaper.id },
      });
      navigate(`/student/attempts/${data.attempt.id}`);
    } catch (err) {
      setAttemptError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <PublicLayout>
        <section className="page-band">
          <p className="muted">Loading group details…</p>
        </section>
      </PublicLayout>
    );
  }

  if (error || !group) {
    return (
      <PublicLayout>
        <section className="page-band">
          <p className="error">{error || 'Question paper group not found'}</p>
          <div style={{ marginTop: '1rem' }}>
            <Link to="/papers" className="btn ghost">← Back to Question Paper Library</Link>
          </div>
        </section>
      </PublicLayout>
    );
  }

  const expectedSubjects = group.numSubjectsPerSchedule || 3;
  const publishedSchedulesCount = group.schedules.filter((s) => s.papers && s.papers.length > 0).length;
  const totalPapersCount = group.schedules.reduce((acc, s) => acc + (s.papers?.length || 0), 0);

  return (
    <PublicLayout>
      <section className="page-band">

        {/* ── Confirmation Modal (Matches previous paper submission execution workflow) ── */}
        {selectedPaper && (
          <div className="modal-overlay" onClick={() => !busy && setSelectedPaper(null)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="modal-badge">Confirm Attempt</div>
              <h2 className="modal-title">{selectedPaper.title}</h2>

              <div className="modal-paper-meta">
                <div className="modal-meta-item">
                  <span className="modal-meta-icon"></span>
                  <div>
                    <strong>{selectedPaper.caLevel}</strong>
                    <span>{selectedPaper.paperType}</span>
                  </div>
                </div>
                <div className="modal-meta-item">
                  <span className="modal-meta-icon"></span>
                  <div>
                    <strong>{selectedPaper.subjectName}</strong>
                    <span>Subject</span>
                  </div>
                </div>
                <div className="modal-meta-item">
                  <span className="modal-meta-icon"></span>
                  <div>
                    <strong>{selectedPaper.durationMinutes} minutes</strong>
                    <span>Duration</span>
                  </div>
                </div>
                <div className="modal-meta-item">
                  <span className="modal-meta-icon"></span>
                  <div>
                    <strong>{selectedPaper.totalMarks} marks</strong>
                    <span>Total marks</span>
                  </div>
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

              {attemptError && <p className="error">{attemptError}</p>}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setSelectedPaper(null)}
                  disabled={busy}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn primary lg"
                  onClick={confirmAttempt}
                  disabled={busy}
                >
                  {busy ? 'Starting exam…' : 'Start Exam'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Breadcrumb ── */}
        <div style={{ marginBottom: '1.25rem' }}>
          <Link
            to="/papers"
            style={{
              color: '#4f46e5',
              fontWeight: 600,
              fontSize: '0.92rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              textDecoration: 'none',
            }}
          >
            ← Back to Question Paper Library
          </Link>
        </div>

        {/* ── Group Detail Hero / Header ── */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            padding: '2rem',
            boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
            marginBottom: '2rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ maxWidth: '750px' }}>
              <span
                style={{
                  background: '#ede9fe',
                  color: '#6d28d9',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  padding: '0.25rem 0.65rem',
                  borderRadius: '6px',
                  display: 'inline-block',
                  marginBottom: '0.5rem',
                }}
              >
                Question Paper Group
              </span>
              <h1 style={{ margin: 0, fontSize: '2.1rem', fontWeight: 800, color: '#0f172a' }}>
                {group.name}
              </h1>

              {/* Schedule details placed directly under group title name */}
              <div
                style={{
                  fontSize: '1.05rem',
                  fontWeight: 600,
                  color: '#4f46e5',
                  marginTop: '0.4rem',
                  letterSpacing: '-0.01em',
                }}
              >
                {group.numSchedules} Schedules · {expectedSubjects} Subjects per Schedule
              </div>

              {group.description && (
                <p className="muted" style={{ margin: '0.85rem 0 0', fontSize: '0.95rem', lineHeight: 1.6 }}>
                  {group.description}
                </p>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Price Circles */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  marginRight: '0.5rem',
                  pointerEvents: 'none',
                }}
              >
                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '50%',
                    background: '#f1f5f9',
                    border: '1.5px solid #cbd5e1',
                    color: '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    textDecoration: 'line-through',
                    userSelect: 'none',
                    transition: 'none',
                  }}
                  title="Original Price: 100 Rs"
                >
                  100 Rs
                </div>
                <div
                  style={{
                    width: '56px',
                    height: '32px',
                    borderRadius: '50%',
                    background: '#dcfce7',
                    border: '1.5px solid #86efac',
                    color: '#15803d',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.02em',
                    userSelect: 'none',
                    transition: 'none',
                  }}
                >
                  Free
                </div>
              </div>

              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '0.65rem 1rem',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>
                  {group.numSchedules}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Total Schedules</div>
              </div>

              <div
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '10px',
                  padding: '0.65rem 1rem',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#16a34a' }}>
                  {publishedSchedulesCount}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: 600 }}>Published</div>
              </div>

              <div
                style={{
                  background: '#eef2ff',
                  border: '1px solid #c7d2fe',
                  borderRadius: '10px',
                  padding: '0.65rem 1rem',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#4f46e5' }}>
                  {totalPapersCount}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#4338ca', fontWeight: 600 }}>Total Papers</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Section Title ── */}
        <div style={{ marginBottom: '1.25rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.35rem', color: '#1e293b' }}>
            Schedules &amp; Question Papers
          </h2>
          <p className="muted" style={{ margin: '0.2rem 0 0', fontSize: '0.88rem' }}>
            Schedules with published question papers are highlighted in bright colors. Schedules pending paper uploads are dimmed and locked.
          </p>
        </div>

        {error && <p className="error" style={{ marginBottom: '1rem' }}>{error}</p>}

        {/* ── Schedules List ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {group.schedules.map((s) => {
            const papers = s.papers || [];
            const hasPapers = papers.length > 0;
            const isAvailable = s.isAvailable ?? (!s.availableAt || new Date(s.availableAt).getTime() <= now);

            // ── CASE 1: SCHEDULE WITH UPLOADED QUESTION PAPERS (BRIGHT COLORS & ACTIVE ATTEMPT OPTION) ──
            if (hasPapers) {
              return (
                <div
                  key={s.scheduleNumber}
                  style={{
                    background: '#ffffff',
                    border: '2px solid #6366f1',
                    borderRadius: '14px',
                    boxShadow: '0 8px 30px rgba(99, 102, 241, 0.12)',
                    overflow: 'hidden',
                  }}
                >
                  {/* Bright Header */}
                  <div
                    style={{
                      padding: '1rem 1.5rem',
                      background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)',
                      borderBottom: '2px solid #c7d2fe',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.75rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                      <span
                        style={{
                          background: '#4f46e5',
                          color: '#ffffff',
                          fontWeight: 800,
                          fontSize: '0.9rem',
                          padding: '0.35rem 0.8rem',
                          borderRadius: '8px',
                          letterSpacing: '0.02em',
                        }}
                      >
                        Schedule {s.scheduleNumber}
                      </span>
                      <div>
                        <strong style={{ fontSize: '1.05rem', color: '#1e1b4b' }}>
                          {papers.length} {papers.length === 1 ? 'Subject Question Paper' : 'Subject Question Papers'} Uploaded
                        </strong>
                        <span style={{ fontSize: '0.82rem', color: '#4338ca', display: 'block' }}>
                          Target: {expectedSubjects} Subjects
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <span style={{ fontSize: '0.85rem', color: '#3730a3', fontWeight: 600 }}>
                        Scheduled Access:
                      </span>
                      {isAvailable ? (
                        <span
                          className="pill published"
                          style={{
                            background: '#dcfce7',
                            color: '#15803d',
                            border: '1px solid #86efac',
                            fontWeight: 700,
                            fontSize: '0.82rem',
                            padding: '0.35rem 0.75rem',
                          }}
                        >
                          ● Available Now
                        </span>
                      ) : (
                        <span
                          className="pill assigned"
                          style={{
                            background: '#fef3c7',
                            color: '#92400e',
                            border: '1px solid #fde68a',
                            fontWeight: 700,
                            fontSize: '0.82rem',
                            padding: '0.35rem 0.75rem',
                          }}
                        >
                          🔒 Opens {formatScheduleDateTime(s.availableAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Uploaded Question Papers Table */}
                  <div style={{ padding: '1rem 1.5rem', overflowX: 'auto' }}>
                    <table className="data-table" style={{ background: '#ffffff', width: '100%' }}>
                      <thead>
                        <tr>
                          <th style={{ color: '#4338ca' }}>Subject</th>
                          <th style={{ color: '#4338ca' }}>Question Paper Title</th>
                          <th style={{ color: '#4338ca' }}>Subject Type</th>
                          <th style={{ color: '#4338ca' }}>Marks &amp; Duration</th>
                          <th style={{ textAlign: 'right', color: '#4338ca' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {papers.map((p) => (
                          <tr key={p.id}>
                            <td>
                              <strong style={{ fontSize: '0.98rem', color: '#0f172a' }}>{p.subjectName}</strong>
                              <div className="muted" style={{ fontSize: '0.78rem' }}>{p.caLevel}</div>
                            </td>
                            <td>
                              <Link
                                to={`/papers/${p.id}`}
                                style={{
                                  fontWeight: 600,
                                  color: '#1e293b',
                                  textDecoration: 'none',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.color = '#4f46e5')}
                                onMouseLeave={(e) => (e.currentTarget.style.color = '#1e293b')}
                              >
                                {p.title}
                              </Link>
                              {p.chapter && (
                                <div className="muted" style={{ fontSize: '0.78rem' }}>{p.chapter}</div>
                              )}
                            </td>
                            <td>
                              <span
                                className="pill"
                                style={{
                                  background: '#ede9fe',
                                  color: '#6d28d9',
                                  fontWeight: 600,
                                  fontSize: '0.75rem',
                                  border: '1px solid #ddd6fe',
                                }}
                              >
                                {p.paperType}
                              </span>
                            </td>
                            <td>
                              <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#334155' }}>
                                {p.totalMarks} marks · {p.durationMinutes} min
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {isAvailable ? (
                                <button
                                  type="button"
                                  className="btn primary"
                                  onClick={() => handleAttemptClick(p, s)}
                                  style={{
                                    fontSize: '0.88rem',
                                    padding: '0.45rem 1.1rem',
                                    background: '#4f46e5',
                                    fontWeight: 700,
                                    boxShadow: '0 2px 8px rgba(79, 70, 229, 0.3)',
                                  }}
                                >
                                  Attempt Paper →
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="btn ghost"
                                  disabled
                                  style={{
                                    fontSize: '0.82rem',
                                    padding: '0.4rem 0.9rem',
                                    border: '1px solid #cbd5e1',
                                    color: '#64748b',
                                    background: '#f8fafc',
                                    cursor: 'not-allowed',
                                  }}
                                  title={`Opens on ${formatScheduleDateTime(s.availableAt)}`}
                                >
                                  🔒 Locked
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            }

            // ── CASE 2: SCHEDULE WITHOUT QUESTION PAPERS (DIM COLORS, STRICTLY UNCLICKABLE) ──
            return (
              <div
                key={s.scheduleNumber}
                style={{
                  border: '1px dashed #cbd5e1',
                  borderRadius: '14px',
                  background: '#f8fafc',
                  opacity: 0.55,
                  cursor: 'not-allowed',
                  pointerEvents: 'none',
                  userSelect: 'none',
                  filter: 'grayscale(80%)',
                  overflow: 'hidden',
                }}
              >
                {/* Dim Header */}
                <div
                  style={{
                    padding: '0.85rem 1.5rem',
                    background: '#f1f5f9',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span
                      style={{
                        background: '#cbd5e1',
                        color: '#475569',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        padding: '0.25rem 0.6rem',
                        borderRadius: '6px',
                      }}
                    >
                      Schedule {s.scheduleNumber}
                    </span>
                    <strong style={{ fontSize: '0.92rem', color: '#64748b' }}>
                      Pending Admin Upload
                    </strong>
                  </div>

                  <div>
                    <span
                      className="pill"
                      style={{
                        background: '#e2e8f0',
                        color: '#64748b',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                      }}
                    >
                      🔒 Unreleased
                    </span>
                  </div>
                </div>

                {/* Dim Body with Disabled Notice */}
                <div style={{ padding: '1.25rem 1.5rem', textAlign: 'center', color: '#94a3b8' }}>
                  <p style={{ margin: 0, fontSize: '0.92rem', fontWeight: 500 }}>
                    Question papers for Schedule {s.scheduleNumber} have not been uploaded by the admin yet.
                  </p>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginTop: '0.3rem' }}>
                    This schedule cannot be clicked or attempted until question papers are published.
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </PublicLayout>
  );
}
