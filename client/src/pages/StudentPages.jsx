import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PortalLayout } from '../components/Layouts';
import { api } from '../lib/api';

// ─── Leave Exam Confirmation Modal ────────────────────────────────────────────
function LeaveExamModal({ onConfirm, onCancel }) {
  return (
    <div className="modal-overlay">
      <div className="modal-card leave-exam-modal">
        <div className="modal-badge leave-badge">⚠️ Leave Exam?</div>
        <h2 className="modal-title">Are you sure you want to leave?</h2>
        <p className="modal-desc">
          If you leave now, the exam timer will keep running. You can return
          to continue, but you will <strong>not</strong> be able to view the
          question paper again once you navigate away.
        </p>
        <div className="modal-actions">
          <button className="btn ghost" onClick={onCancel}>
            Stay in Exam
          </button>
          <button className="btn danger" onClick={onConfirm}>
            Leave Exam
          </button>
        </div>
      </div>
    </div>
  );
}

const studentLinks = [
  { to: '/student', label: 'Dashboard', end: true },
  { to: '/student/submissions', label: 'My submissions' },
  { to: '/papers', label: 'Browse papers' },
];

function statusLabel(status) {
  return String(status || '').replaceAll('_', ' ');
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
              <strong>{data.inProgress}</strong>
              <span>In progress</span>
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
                        <Link to={`/student/attempts/${a.id}/result`}>View result</Link>
                      ) : a.status === 'in_progress' ? (
                        <Link to={`/student/attempts/${a.id}`}>Continue</Link>
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
                    <Link to={`/student/attempts/${a.id}/result`}>Result</Link>
                  ) : a.status === 'in_progress' ? (
                    <Link to={`/student/attempts/${a.id}`}>Submit</Link>
                  ) : (
                    '—'
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

  // Intercept browser back button during exam
  useEffect(() => {
    // Push a dummy history entry so we can catch the back navigation
    window.history.pushState(null, '', window.location.href);

    function handlePopState() {
      if (phaseRef.current === 'in_exam') {
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
      setError('Please upload your handwritten answer PDF or image.');
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
          <div className="exam-submitted-icon">✅</div>
          <h2>Answers submitted!</h2>
          <p className="muted">Your answer sheet has been received successfully. You will be notified once it is evaluated.</p>
          <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem' }}>
            <Link to="/student" className="btn primary">Go to dashboard</Link>
            <Link to="/student/submissions" className="btn ghost">My submissions</Link>
          </div>
        </div>
      </PortalLayout>
    );
  }

  // ── Pre-Start Screen ────────────────────────────────────────────────────────
  if (phase === 'pre_start') {
    return (
      <PortalLayout title="Student portal" links={studentLinks}>
        <div className="exam-prestart-wrap">
          <div className="exam-prestart-card panel">
            <div className="exam-prestart-badge">📋 Exam</div>
            <h1 className="exam-prestart-title">{attempt?.paperTitle}</h1>

            <div className="exam-prestart-meta">
              <div className="exam-meta-item">
                <span className="exam-meta-icon">⏱️</span>
                <div>
                  <strong>{attempt?.durationMinutes} minutes</strong>
                  <span>Duration</span>
                </div>
              </div>
              <div className="exam-meta-item">
                <span className="exam-meta-icon">📝</span>
                <div>
                  <strong>{attempt?.totalMarks} marks</strong>
                  <span>Total marks</span>
                </div>
              </div>
              <div className="exam-meta-item">
                <span className="exam-meta-icon">🎓</span>
                <div>
                  <strong>{attempt?.caLevel}</strong>
                  <span>{attempt?.paperType}</span>
                </div>
              </div>
            </div>

            <div className="exam-instructions">
              <h3>📌 Instructions</h3>
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

            <button className="btn primary lg exam-start-btn" onClick={startExam}>
              🚀 Start Exam
            </button>
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
            onConfirm={() => {
              setShowLeaveModal(false);
              navigate('/student');
            }}
            onCancel={() => setShowLeaveModal(false)}
          />
        )}

        {/* Top bar */}
        <div className="exam-topbar">
          <div className="exam-topbar-title">
            <span className="exam-topbar-badge">📋</span>
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
            ✋ End Exam
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
              <div className="exam-no-pdf-icon">📄</div>
              <h3>No PDF available for this paper.</h3>
              <p className="muted">Please check with your instructor. Use your time to write answers.</p>
              <button className="btn danger" onClick={endExam} style={{ marginTop: '1rem' }}>
                ✋ End Exam &amp; Submit Answers
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
        <div className="exam-submit-wrap">
          <div className="panel exam-submit-card">
            <div className="exam-submit-header">
              <div>
                <h2>Submit your answers</h2>
                <p className="muted">{attempt?.paperTitle}</p>
              </div>
              <div className="exam-time-over-badge">
                ⏰ Exam ended
              </div>
            </div>

            <div className="exam-submit-instructions">
              <p>📷 Take a clear scan or photo of your handwritten answer sheet and upload it below.</p>
              <p>Accepted formats: <strong>PDF, JPG, PNG, WEBP</strong> (max 15 MB)</p>
            </div>

            <form className="form" onSubmit={submit}>
              <label>
                Upload handwritten answer (PDF / image)
                <input
                  type="file"
                  accept=".pdf,image/*"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </label>
              {error && <p className="error">{error}</p>}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                <button className="btn primary lg" disabled={busy}>
                  {busy ? 'Submitting…' : '📤 Submit answers'}
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
            <h2>{paper.title}</h2>
            <p className="muted">Reviewed by {evaluation.reviewerName}</p>
          </div>
        </div>
        <p>
          <strong>Overall feedback:</strong> {evaluation.feedback || '—'}
        </p>
        {submission?.annotatedPdfUrl && (
          <div className="annotated-pdf-box">
            <span className="annotated-pdf-icon">📑</span>
            <div>
              <strong>Reviewed answer sheet</strong>
              <p className="muted" style={{ margin: '0.15rem 0 0.5rem' }}>
                Click below to view result
              </p>
              <a
                href={submission.annotatedPdfUrl}
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
