import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PortalLayout } from '../components/Layouts';
import { api } from '../lib/api';

// ─── Leave Exam Confirmation Modal ────────────────────────────────────────────
function LeaveExamModal({ onConfirm, onCancel, busy }) {
  return (
    <div className="modal-overlay">
      <div className="modal-card leave-exam-modal">
        <div className="modal-badge leave-badge">Leave Exam?</div>
        <h2 className="modal-title">Leave without submitting?</h2>
        <p className="modal-desc">
          If you go back or leave now, this will <strong>not</strong> be counted as an attempt. You can start a fresh attempt anytime.
        </p>
        <div className="modal-actions">
          <button className="btn ghost" onClick={onCancel} disabled={busy}>
            Stay in Exam
          </button>
          <button className="btn danger" onClick={onConfirm} disabled={busy}>
            {busy ? 'Leaving…' : 'Leave Exam'}
          </button>
        </div>
      </div>
    </div>
  );
}

const studentLinks = [
  { to: '/student', label: 'Dashboard', end: true },
  { to: '/papers', label: 'Browse papers' },
  { to: '/student/results', label: 'Results' },
];

function statusLabel(status) {
  return String(status || '').replaceAll('_', ' ');
}

// ─── Viewed Results Persistence (Green at first, Black once clicked) ─────────
const VIEWED_RESULTS_KEY = 'mentaura_viewed_results';

function getViewedResults() {
  try {
    const raw = localStorage.getItem(VIEWED_RESULTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function markResultViewed(id) {
  try {
    const current = getViewedResults();
    if (!current.includes(id)) {
      localStorage.setItem(VIEWED_RESULTS_KEY, JSON.stringify([...current, id]));
    }
  } catch {
    /* ignore */
  }
}

function ViewResultLink({ attemptId, label = 'View result' }) {
  const [viewed, setViewed] = useState(() => getViewedResults().includes(attemptId));

  function handleClick() {
    markResultViewed(attemptId);
    setViewed(true);
  }

  return (
    <Link
      to={`/student/attempts/${attemptId}/result`}
      onClick={handleClick}
      className={`result-link ${viewed ? 'result-link-viewed' : 'result-link-new'}`}
    >
      {label}
    </Link>
  );
}


// ─── Countdown Timer Component ────────────────────────────────────────────────
function CountdownTimer({ deadline, onExpire }) {
  const [remaining, setRemaining] = useState(0);
  const expiredRef = useRef(false);

  useEffect(() => {
    function tick() {
      const ms = new Date(deadline) - Date.now();
      if (ms <= 0) {
        setRemaining(0);
        if (!expiredRef.current) {
          expiredRef.current = true;
          onExpire();
        }
      } else {
        setRemaining(ms);
      }
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadline, onExpire]);

  const totalSecs = Math.max(0, Math.floor(remaining / 1000));
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  const pad = (n) => String(n).padStart(2, '0');

  const isUrgent = totalSecs < 300; // last 5 minutes

  return (
    <div className={`exam-timer ${isUrgent ? 'urgent' : ''}`}>
      <span className="timer-label">Time remaining</span>
      <span className="timer-digits">
        {h > 0 && <>{pad(h)}:</>}{pad(m)}:{pad(s)}
      </span>
    </div>
  );
}

// ─── Student Dashboard ─────────────────────────────────────────────────────────
export function StudentDashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api('/api/student/dashboard').then(setData);
  }, []);

  return (
    <PortalLayout title="Student portal" links={studentLinks}>
      {!data ? (
        <p className="muted">Loading…</p>
      ) : (
        <>
          <div className="stats-grid">
            <div className="stat-tile">
              <strong>{data.totalSubmissions ?? (data.pendingEvaluations + data.completedEvaluations)}</strong>
              <span>Total submitted</span>
            </div>
            <div className="stat-tile">
              <strong>{data.pendingEvaluations}</strong>
              <span>Pending evaluation</span>
            </div>
            <div className="stat-tile">
              <strong>{data.completedEvaluations}</strong>
              <span>Completed</span>
            </div>
          </div>
          <div className="panel">
            <div className="panel-head">
              <h2>Recent attempts</h2>
              <Link to="/papers" className="btn primary">
                Attempt a paper
              </Link>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Paper</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.recentAttempts.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted">
                      No attempts yet.
                    </td>
                  </tr>
                )}
                {data.recentAttempts.map((a) => (
                  <tr key={a.id}>
                    <td>{a.paperTitle}</td>
                    <td>
                      <span className={`pill ${a.status}`}>{statusLabel(a.status)}</span>
                    </td>
                    <td>{new Date(a.updatedAt).toLocaleString()}</td>
                    <td>
                      {a.status === 'evaluated' ? (
                        <ViewResultLink attemptId={a.id} />
                      ) : (
                        <Link to={`/student/attempts/${a.id}`}>View</Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </PortalLayout>
  );
}

// ─── Student Submissions ───────────────────────────────────────────────────────
export function StudentSubmissions() {
  const [attempts, setAttempts] = useState([]);

  useEffect(() => {
    api('/api/student/mine').then((d) => setAttempts(d.attempts));
  }, []);

  return (
    <PortalLayout title="Student portal" links={studentLinks}>
      <div className="panel">
        <h2>My submissions</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Question paper</th>
              <th>Submitted</th>
              <th>Status</th>
              <th>Marks</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {attempts.map((a) => (
              <tr key={a.id}>
                <td>{a.paperTitle}</td>
                <td>{a.submittedAt ? new Date(a.submittedAt).toLocaleString() : '—'}</td>
                <td>
                  <span className={`pill ${a.status}`}>{statusLabel(a.status)}</span>
                </td>
                <td>
                  {a.evaluation ? `${a.evaluation.totalMarks} / ${a.totalMarks}` : '—'}
                </td>
                <td>
                  {a.status === 'evaluated' ? (
                    <ViewResultLink attemptId={a.id} label="View result" />
                  ) : (
                    <Link to={`/student/attempts/${a.id}`}>View</Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PortalLayout>
  );
}

// ─── Attempt Page ──────────────────────────────────────────────────────────────
// Exam phases:
//   'loading'      – fetching attempt data
//   'pre_start'    – show exam info, "Start Exam" button
//   'in_exam'      – PDF viewer + countdown, no download
//   'post_exam'    – timer ended or "End Exam" clicked → upload answer form
//   'submitted'    – answer has been submitted
//   'already_done' – attempt was already submitted/evaluated
export function AttemptPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState(null);
  const [paper, setPaper] = useState(null);
  const [phase, setPhase] = useState('loading');
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const phaseRef = useRef(phase);

  // Keep phaseRef in sync so the popstate handler has the latest value
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  async function handleDiscardAndLeave() {
    setBusy(true);
    try {
      await api(`/api/student/${id}/discard`, { method: 'POST' });
    } catch {
      // ignore
    } finally {
      setBusy(false);
      setShowLeaveModal(false);
      navigate('/student');
    }
  }

  // Intercept browser back button during exam
  useEffect(() => {
    // Push a dummy history entry so we can catch the back navigation
    window.history.pushState(null, '', window.location.href);

    function handlePopState() {
      if (['in_exam', 'pre_start', 'post_exam'].includes(phaseRef.current)) {
        // Re-push so the user stays on the page until they confirm
        window.history.pushState(null, '', window.location.href);
        setShowLeaveModal(true);
      }
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Fetch attempt on mount
  useEffect(() => {
    api(`/api/student/${id}`)
      .then((d) => {
        const a = d.attempt;
        setAttempt(a);

        // Fetch the full paper to get pdfUrl
        api(`/api/papers/${a.questionPaperId}`)
          .then((pd) => setPaper(pd.paper))
          .catch(() => setPaper(null));

        if (a.status === 'evaluated') {
          navigate(`/student/attempts/${id}/result`);
        } else if (['submitted', 'assigned', 'under_review'].includes(a.status)) {
          setPhase('already_done');
        } else if (a.status === 'in_progress') {
          // If deadline already passed, go to post_exam immediately
          if (new Date(a.deadline) <= new Date()) {
            setPhase('post_exam');
          } else {
            // Returning to an in-progress exam → resume the exam (show PDF)
            setPhase('in_exam');
          }
        } else {
          setPhase('pre_start');
        }
      })
      .catch((e) => {
        setError(e.message);
        setPhase('loading');
      });
  }, [id, navigate]);

  // Called when timer expires
  const handleTimerExpire = useCallback(() => {
    setPhase('post_exam');
  }, []);

  // Start exam
  function startExam() {
    setPhase('in_exam');
  }

  // End exam early
  function endExam() {
    if (window.confirm('Are you sure you want to end the exam? You will not be able to view the question paper again.')) {
      setPhase('post_exam');
    }
  }

  // Submit answer
  async function submit(e) {
    e.preventDefault();
    if (!file) {
      setError('Please upload your handwritten answer as a PDF file.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const body = new FormData();
      body.append('answerFile', file);
      const data = await api(`/api/student/${id}/submit`, { method: 'POST', body });
      setAttempt(data.attempt);
      setPhase('submitted');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // ── Loading / Error ─────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <PortalLayout title="Student portal" links={studentLinks}>
        {error ? (
          <p className="error">{error}</p>
        ) : (
          <p className="muted">Loading attempt…</p>
        )}
      </PortalLayout>
    );
  }

  // ── Already Submitted ───────────────────────────────────────────────────────
  if (phase === 'already_done') {
    return (
      <PortalLayout title="Student portal" links={studentLinks}>
        <div className="panel">
          <h2>{attempt?.paperTitle}</h2>
          <div className="success-box">
            <p>Your answer has been submitted. An admin will assign a reviewer shortly.</p>
            {attempt?.submission?.answerFileUrl && (
              <a href={attempt.submission.answerFileUrl} target="_blank" rel="noreferrer">
                View uploaded file
              </a>
            )}
          </div>
          <div style={{ marginTop: '1rem' }}>
            <Link to="/student" className="btn ghost">← Back to dashboard</Link>
          </div>
        </div>
      </PortalLayout>
    );
  }

  // ── Submitted (just now) ────────────────────────────────────────────────────
  if (phase === 'submitted') {
    return (
      <PortalLayout title="Student portal" links={studentLinks}>
        <div className="panel exam-submitted-panel">
          <div className="exam-submitted-icon"></div>
          <h2>Answers submitted!</h2>
          <p className="muted">Your answer sheet has been received successfully. You will be notified once it is evaluated.</p>
          <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem' }}>
            <Link to="/student" className="btn primary">Go to dashboard</Link>
            <Link to="/papers" className="btn ghost">Browse papers</Link>
          </div>
        </div>
      </PortalLayout>
    );
  }

  // ── Pre-Start Screen ────────────────────────────────────────────────────────
  if (phase === 'pre_start') {
    return (
      <PortalLayout title="Student portal" links={studentLinks}>
        {showLeaveModal && (
          <LeaveExamModal
            onConfirm={handleDiscardAndLeave}
            onCancel={() => setShowLeaveModal(false)}
            busy={busy}
          />
        )}
        <div className="exam-prestart-wrap">
          <div className="exam-prestart-card panel">
            <div className="exam-prestart-badge">Exam</div>
            <h1 className="exam-prestart-title">{attempt?.paperTitle}</h1>

            <div className="exam-prestart-meta">
              <div className="exam-meta-item">
                <span className="exam-meta-icon"></span>
                <div>
                  <strong>{attempt?.durationMinutes} minutes</strong>
                  <span>Duration</span>
                </div>
              </div>
              <div className="exam-meta-item">
                <span className="exam-meta-icon"></span>
                <div>
                  <strong>{attempt?.totalMarks} marks</strong>
                  <span>Total marks</span>
                </div>
              </div>
              <div className="exam-meta-item">
                <span className="exam-meta-icon"></span>
                <div>
                  <strong>{attempt?.caLevel}</strong>
                  <span>{attempt?.paperType}</span>
                </div>
              </div>
            </div>

            <div className="exam-instructions">
              <h3>Instructions</h3>
              <ul>
                <li>The timer will start as soon as you click <strong>Start Exam</strong>.</li>
                <li>The question paper will be displayed on screen. <strong>Downloading is not allowed.</strong></li>
                <li>Write your answers on paper.</li>
                <li>When the timer ends, the question paper will be closed automatically.</li>
                <li>You can also click <strong>End Exam</strong> to close the paper early.</li>
                <li>After the exam, upload a scan or photo of your handwritten answers to submit.</li>
              </ul>
            </div>

            {error && <p className="error">{error}</p>}

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
              <button className="btn primary lg exam-start-btn" onClick={startExam}>
                Start Exam
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={handleDiscardAndLeave}
                disabled={busy}
              >
                Cancel &amp; Go Back
              </button>
            </div>
          </div>
        </div>
      </PortalLayout>
    );
  }

  // ── In-Exam Screen ──────────────────────────────────────────────────────────
  if (phase === 'in_exam') {
    return (
      <div className="exam-fullscreen">
        {/* Leave-Exam confirmation modal */}
        {showLeaveModal && (
          <LeaveExamModal
            onConfirm={handleDiscardAndLeave}
            onCancel={() => setShowLeaveModal(false)}
            busy={busy}
          />
        )}

        {/* Top bar */}
        <div className="exam-topbar">
          <button
            type="button"
            className="btn ghost exam-back-btn"
            onClick={() => setShowLeaveModal(true)}
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
          >
            ← Exit
          </button>
          <div className="exam-topbar-title">
            <span className="exam-topbar-badge"></span>
            <strong>{attempt?.paperTitle}</strong>
          </div>

          {attempt?.deadline && (
            <CountdownTimer
              deadline={attempt.deadline}
              onExpire={handleTimerExpire}
            />
          )}

          <button
            className="btn danger end-exam-btn"
            onClick={endExam}
          >
            End Exam
          </button>
        </div>

        {/* PDF Viewer */}
        <div className="exam-pdf-area">
          {paper?.pdfUrl ? (
            <iframe
              key={paper.pdfUrl}
              className="exam-pdf-frame"
              title="Question paper"
              src={`${paper.pdfUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
            />
          ) : (
            <div className="exam-no-pdf">
              <div className="exam-no-pdf-icon"></div>
              <h3>No PDF available for this paper.</h3>
              <p className="muted">Please check with your instructor. Use your time to write answers.</p>
              <button className="btn danger" onClick={endExam} style={{ marginTop: '1rem' }}>
                End Exam &amp; Submit Answers
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Post-Exam: Upload Answer ─────────────────────────────────────────────────
  if (phase === 'post_exam') {
    return (
      <PortalLayout title="Student portal" links={studentLinks}>
        {showLeaveModal && (
          <LeaveExamModal
            onConfirm={handleDiscardAndLeave}
            onCancel={() => setShowLeaveModal(false)}
            busy={busy}
          />
        )}
        <div className="exam-submit-wrap">
          <div className="panel exam-submit-card">
            <div className="exam-submit-header">
              <div>
                <h2>Submit your answers</h2>
                <p className="muted">{attempt?.paperTitle}</p>
              </div>
              <div className="exam-time-over-badge">
                Exam ended
              </div>
            </div>

            <div className="exam-submit-instructions">
              <p>Take a clear scan or photo of your handwritten answer sheet, save it as a PDF, and upload it below.</p>
              <p>Accepted format: <strong>PDF only</strong> (max 15 MB)</p>
            </div>

            <form className="form" onSubmit={submit}>
              <label>
                Upload handwritten answer (PDF only)
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </label>
              {error && <p className="error">{error}</p>}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                <button className="btn primary lg" disabled={busy}>
                  {busy ? 'Submitting…' : 'Submit answers'}
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={handleDiscardAndLeave}
                  disabled={busy}
                >
                  Cancel &amp; Discard Attempt
                </button>
              </div>
            </form>
          </div>
        </div>
      </PortalLayout>
    );
  }

  return null;
}

// ─── Result Page ───────────────────────────────────────────────────────────────
export function ResultPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    markResultViewed(id);
    api(`/api/student/${id}/result`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) {
    return (
      <PortalLayout title="Student portal" links={studentLinks}>
        <p className="error">{error}</p>
      </PortalLayout>
    );
  }

  if (!data) {
    return (
      <PortalLayout title="Student portal" links={studentLinks}>
        <p className="muted">Loading result…</p>
      </PortalLayout>
    );
  }

  const { paper, evaluation, submission } = data;

  return (
    <PortalLayout title="Student portal" links={studentLinks}>
      <div className="panel">
        <div className="panel-head">
          <div>
            {paper.groupName && (
              <p style={{
                margin: '0 0 0.25rem',
                fontSize: '0.78rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--accent)',
              }}>
                {paper.groupName}
              </p>
            )}
            <h2 style={{ margin: 0 }}>
              {paper.scheduleNumber != null
                ? `Schedule ${paper.scheduleNumber} — ${paper.title}`
                : paper.title}
            </h2>
            <p className="muted" style={{ marginTop: '0.25rem' }}>Reviewed by {evaluation.reviewerName}</p>
          </div>
        </div>
        <p>
          <strong>Overall feedback:</strong> {evaluation.feedback || '—'}
        </p>
        {evaluation.totalMarks != null && (
          <p>
            <strong>Marks:</strong>{' '}
            <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>
              {evaluation.totalMarks}
            </span>
            {paper.totalMarks ? (
              <span style={{ color: 'var(--ink-soft)' }}> / {paper.totalMarks}</span>
            ) : null}
          </p>
        )}
        {submission?.answerFileUrl && (
          <div className="annotated-pdf-box">
            <span className="annotated-pdf-icon"></span>
            <div>
              <strong>Reviewed answer sheet</strong>
              <p className="muted" style={{ margin: '0.15rem 0 0.5rem' }}>
                Click below to view result
              </p>
              <a
                href={`${submission.answerFileUrl}?v=${encodeURIComponent(evaluation.evaluatedAt || '')}`}
                target="_blank"
                rel="noreferrer"
                className="btn primary annotated-pdf-btn"
              >
                Open result
              </a>
            </div>
          </div>
        )}
      </div>
    </PortalLayout>
  );
}

// ─── Student Published Results ─────────────────────────────────────────────────────
export function StudentResults() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedResult, setSelectedResult] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  useEffect(() => {
    api('/api/student/published-results')
      .then((d) => { setResults(d.results || []); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  async function openDetail(result) {
    setSelectedResult(result);
    setDetailLoading(true);
    setDetailError('');
    setDetail(null);
    try {
      const d = await api(`/api/student/published-results/${result.groupId}`);
      setDetail(d);
    } catch (e) {
      setDetailError(e.message);
    } finally {
      setDetailLoading(false);
    }
  }

  // ── Detail view ──────────────────────────────────────────────────────────────
  if (selectedResult) {
    const pub = detail?.publication;
    return (
      <PortalLayout title="Student portal" links={studentLinks}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <button className="btn ghost" onClick={() => { setSelectedResult(null); setDetail(null); }}>← My Results</button>
          <span className="muted" style={{ fontSize: '0.9rem' }}>/ {selectedResult.groupName}</span>
        </div>

        {detailLoading && <p className="muted">Loading details…</p>}
        {detailError && <p className="error">{detailError}</p>}

        {!detailLoading && detail && (
          <>
            {/* Result card */}
            <div className="panel" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <div>
                  <p style={{ margin: '0 0 0.25rem', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent)' }}>
                    {detail.group.caLevel}
                  </p>
                  <h2 style={{ margin: 0 }}>{detail.group.name}</h2>
                  <p className="muted" style={{ margin: '0.3rem 0 0', fontSize: '0.88rem' }}>
                    Published on {new Date(pub.publishedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
                <div style={{
                  textAlign: 'center',
                  padding: '1rem 1.5rem',
                  borderRadius: '14px',
                  background: pub.result === 'PASS' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                  border: `2px solid ${pub.result === 'PASS' ? '#22c55e' : '#ef4444'}`,
                }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>{pub.result === 'PASS' ? '✅' : '❌'}</div>
                  <div style={{
                    fontSize: '1.5rem',
                    fontWeight: 800,
                    color: pub.result === 'PASS' ? '#16a34a' : '#dc2626',
                    letterSpacing: '0.04em',
                  }}>
                    {pub.result}
                  </div>
                </div>
              </div>

              {pub.totalMaxMarks > 0 && (
                <div className="stats-grid" style={{ marginTop: '1.25rem' }}>
                  {[
                    ['Marks Obtained', `${pub.totalMarksAwarded} / ${pub.totalMaxMarks}`],
                    ['Overall Percentage', pub.overallPct != null ? `${pub.overallPct}%` : '—'],
                  ].map(([label, val]) => (
                    <div className="stat-tile" key={label}>
                      <strong style={{ fontSize: '1.1rem' }}>{val}</strong>
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
              )}

              {pub.feedback && (
                <div style={{ marginTop: '1.25rem', padding: '1rem', borderRadius: '10px', background: 'var(--accent-soft, #f8fafc)', border: '1px solid var(--border)' }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.35rem' }}>Admin Remarks</p>
                  <p style={{ margin: 0, fontSize: '0.9rem' }}>{pub.feedback}</p>
                </div>
              )}
            </div>

            {/* Paper-wise breakdown */}
            <h3 style={{ marginBottom: '1rem' }}>Paper-wise Marks</h3>
            {(detail.schedules || []).map((sched) => (
              sched.papers.length > 0 && (
                <div key={sched.scheduleNumber} className="panel" style={{ marginBottom: '1.25rem' }}>
                  <div className="panel-head">
                    <h3 style={{ margin: 0 }}>Schedule {sched.scheduleNumber}</h3>
                    {sched.availableAt && (
                      <span className="muted" style={{ fontSize: '0.82rem' }}>
                        {new Date(sched.availableAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Subject</th>
                        <th>Paper</th>
                        <th style={{ textAlign: 'center' }}>Status</th>
                        <th style={{ textAlign: 'right' }}>Max Marks</th>
                        <th style={{ textAlign: 'right' }}>Marks Obtained</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sched.papers.map((paper) => {
                        const pct = paper.marksAwarded != null && paper.totalMarks
                          ? Math.round((paper.marksAwarded / paper.totalMarks) * 100)
                          : null;
                        return (
                          <tr key={paper.paperId}>
                            <td><strong style={{ fontSize: '0.92rem' }}>{paper.subjectName}</strong></td>
                            <td><span style={{ fontWeight: 500 }}>{paper.title}</span></td>
                            <td style={{ textAlign: 'center' }}>
                              {paper.isExempted ? (
                                <span className="pill info" style={{ fontSize: '0.75rem' }}>Exempted</span>
                              ) : (
                                <span className="pill published" style={{ fontSize: '0.75rem' }}>Evaluated</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {paper.isExempted ? <span className="muted">—</span> : paper.totalMarks}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {paper.isExempted ? (
                                <span className="muted" style={{ fontStyle: 'italic', fontSize: '0.85rem' }}>Exempted</span>
                              ) : paper.marksAwarded != null ? (
                                <span style={{ fontWeight: 700, color: pct >= 60 ? 'var(--ok)' : pct >= 40 ? 'var(--warn)' : 'var(--danger)' }}>
                                  {paper.marksAwarded}
                                  <span className="muted" style={{ fontWeight: 400, fontSize: '0.78rem', marginLeft: '0.3rem' }}>({pct}%)</span>
                                </span>
                              ) : (
                                <span className="muted">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            ))}
          </>
        )}
      </PortalLayout>
    );
  }

  // ── List view ────────────────────────────────────────────────────────────────
  return (
    <PortalLayout title="Student portal" links={studentLinks}>
      <div className="panel-head" style={{ marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>My Results</h2>
          <p className="muted" style={{ margin: '0.25rem 0 0', fontSize: '0.88rem' }}>
            Officially published results from the academy.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="muted">Loading results…</p>
      ) : error ? (
        <p className="error">{error}</p>
      ) : results.length === 0 ? (
        <div className="panel" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📋</p>
          <h3 style={{ margin: '0 0 0.5rem' }}>No results published yet</h3>
          <p className="muted" style={{ fontSize: '0.9rem' }}>
            Your results have not been published yet. Please check again later.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {results.map((r) => (
            <div
              key={r.groupId}
              className="panel"
              style={{
                padding: '1.25rem 1.5rem',
                cursor: 'pointer',
                borderLeft: `4px solid ${r.result === 'PASS' ? '#22c55e' : '#ef4444'}`,
                transition: 'box-shadow 0.18s, transform 0.18s',
              }}
              onClick={() => openDetail(r)}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.transform = ''; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{r.groupName}</h3>
                  <p className="muted" style={{ margin: '0.2rem 0 0', fontSize: '0.82rem' }}>
                    {r.caLevel} · Published {new Date(r.publishedAt).toLocaleDateString()}
                  </p>
                  {r.feedback && (
                    <p className="muted" style={{ margin: '0.4rem 0 0', fontSize: '0.85rem', fontStyle: 'italic' }}>
                      “{r.feedback}”
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  {r.totalMaxMarks > 0 && (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{r.totalMarksAwarded} / {r.totalMaxMarks}</div>
                      <div className="muted" style={{ fontSize: '0.75rem' }}>{r.overallPct != null ? `${r.overallPct}%` : ''}</div>
                    </div>
                  )}
                  <span style={{
                    fontSize: '1rem',
                    fontWeight: 800,
                    padding: '0.4rem 1rem',
                    borderRadius: '8px',
                    background: r.result === 'PASS' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                    color: r.result === 'PASS' ? '#16a34a' : '#dc2626',
                    letterSpacing: '0.04em',
                  }}>
                    {r.result}
                  </span>
                  <span style={{ fontSize: '1rem', color: '#9ca3af' }}>›</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </PortalLayout>
  );
}
