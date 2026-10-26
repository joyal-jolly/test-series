import { Component, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PortalLayout } from '../components/Layouts';
import PDFAnnotator from '../components/PDFAnnotator';
import { api } from '../lib/api';

// ─── Error Boundary ───────────────────────────────────────────────────────────
export class ReviewErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="rev-shell">
          <div className="rev-topbar">
            <Link to="/reviewer/assignments" className="rev-back-btn">← Assignments</Link>
            <span className="rev-topbar-title">Error loading review page</span>
          </div>
          <div style={{ padding: '2rem', color: '#f87171' }}>
            <h2>Something went wrong</h2>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem', marginTop: '1rem', background: '#1e293b', padding: '1rem', borderRadius: '0.5rem' }}>
              {this.state.error?.message || String(this.state.error)}
            </pre>
            <button
              className="btn primary"
              style={{ marginTop: '1rem' }}
              onClick={() => { this.setState({ error: null }); window.location.reload(); }}
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const reviewerLinks = [
  { to: '/reviewer', label: 'Dashboard', end: true },
  { to: '/reviewer/assignments', label: 'Assigned evaluations' },
];

// ─── Reviewer Dashboard ───────────────────────────────────────────────────────
export function ReviewerDashboard() {
  const [data, setData] = useState(null);
  useEffect(() => {
    api('/api/reviewer/dashboard').then(setData);
  }, []);

  return (
    <PortalLayout title="Reviewer portal" links={reviewerLinks}>
      {!data ? (
        <p className="muted">Loading…</p>
      ) : (
        <>
          <div className="stats-grid">
            <div className="stat-tile">
              <strong>{data.pendingCount}</strong>
              <span>Pending</span>
            </div>
            <div className="stat-tile">
              <strong>{data.completedCount}</strong>
              <span>Completed</span>
            </div>
          </div>
          <div className="panel">
            <h2>Recent assignments</h2>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Paper</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.recentAssignments.map((a) => (
                  <tr key={a.id}>
                    <td>{a.paperTitle}</td>
                    <td>
                      <span className={`pill ${a.status}`}>{a.status}</span>
                    </td>
                    <td>
                      <Link to={`/reviewer/assignments/${a.id}`}>Open</Link>
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

// ─── Reviewer Assignments List ────────────────────────────────────────────────
export function ReviewerAssignments() {
  const [assignments, setAssignments] = useState([]);
  const [filter, setFilter] = useState('pending');

  useEffect(() => {
    api(`/api/reviewer/assignments?status=${filter}`).then((d) =>
      setAssignments(d.assignments)
    );
  }, [filter]);

  return (
    <PortalLayout title="Reviewer portal" links={reviewerLinks}>
      <div className="panel">
        <div className="panel-head">
          <h2>Assigned evaluations</h2>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="">All</option>
          </select>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Paper</th>
              <th>Assigned</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((a) => (
              <tr key={a.id}>
                <td>{a.paperTitle}</td>
                <td>{a.assignedAt ? new Date(a.assignedAt).toLocaleString() : '—'}</td>
                <td>
                  <span className={`pill ${a.status}`}>{a.status}</span>
                </td>
                <td>
                  <Link to={`/reviewer/assignments/${a.id}`}>Review</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PortalLayout>
  );
}

// ─── Full-page Review Interface ───────────────────────────────────────────────
export function ReviewSubmissionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [marksAwarded, setMarksAwarded] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [draftBusy, setDraftBusy] = useState(false);
  const [draftMsg, setDraftMsg] = useState(null); // { ok: bool, text: string }
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [exportStatus, setExportStatus] = useState(''); // '' | 'exporting' | 'uploading'


  // Ref to the answer PDFAnnotator so we can call exportAnnotatedPdf() / getAnnotations() / loadAnnotations()
  const answerAnnotatorRef = useRef(null);
  // Pending annotations to load once the PDFAnnotator has finished rendering
  const pendingAnnotsRef = useRef(null);
  const annotationsLoadedRef = useRef(false);

  // Which PDF is visible in the left panel: 'answer' | 'paper'
  // IMPORTANT: Both PDFAnnotator instances stay MOUNTED at all times so that
  // annotations drawn on one are never lost when the user switches tabs.
  // Only CSS display changes.
  const [viewMode, setViewMode] = useState('answer');

  useEffect(() => {
    api(`/api/reviewer/assignments/${id}`)
      .then((d) => {
        setData(d);
        // Prefer the final evaluation feedback; fall back to saved draft
        const savedFeedback =
          d.evaluation?.feedback ||
          d.assignment?.draftFeedback ||
          '';
        setFeedback(savedFeedback);
        // Restore marks from evaluation or draft
        if (d.evaluation?.totalMarks != null) {
          setMarksAwarded(String(d.evaluation.totalMarks));
        } else if (d.assignment?.draftMarks != null) {
          setMarksAwarded(String(d.assignment.draftMarks));
        }
        if (d.assignment?.draftSavedAt && !d.evaluation) {
          setLastSavedAt(new Date(d.assignment.draftSavedAt));
        }
        // Store draft annotations to be loaded once the PDF annotator is ready
        if (d.assignment?.draftAnnotations && !d.evaluation) {
          pendingAnnotsRef.current = d.assignment.draftAnnotations;
        }
      })
      .catch((e) => setError(e.message));
  }, [id]);

  // Poll until the annotator ref is available, then load saved annotations once.
  // Empty dep array [] – run once on mount only.
  useEffect(() => {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (annotationsLoadedRef.current || attempts > 50) {
        clearInterval(interval);
        return;
      }
      if (!pendingAnnotsRef.current) return;
      if (answerAnnotatorRef.current?.loadAnnotations) {
        answerAnnotatorRef.current.loadAnnotations(pendingAnnotsRef.current);
        annotationsLoadedRef.current = true;
        pendingAnnotsRef.current = null;
        clearInterval(interval);
      }
    }, 200);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveDraft() {
    setDraftBusy(true);
    setDraftMsg(null);
    try {
      // Capture current annotation state from the PDF annotator
      const draftAnnotations = answerAnnotatorRef.current?.getAnnotations?.() ?? null;
      const result = await api(`/api/reviewer/assignments/${id}/draft`, {
        method: 'PATCH',
        body: { feedback, draftAnnotations, draftMarks: marksAwarded !== '' ? Number(marksAwarded) : null },
      });
      const saved = new Date(result.savedAt);
      setLastSavedAt(saved);
      setDraftMsg({ ok: true, text: 'Draft saved — annotations preserved!' });
    } catch (err) {
      setDraftMsg({ ok: false, text: err.message || 'Failed to save draft' });
    } finally {
      setDraftBusy(false);
      setTimeout(() => setDraftMsg(null), 4000);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    let annotatedPdfUrl = null;
    try {
      // Step 1: Export the annotated answer PDF
      if (answerAnnotatorRef.current) {
        setExportStatus('exporting');
        const blob = await answerAnnotatorRef.current.exportAnnotatedPdf();

        // Step 2: Upload the annotated PDF to the server
        setExportStatus('uploading');
        const form = new FormData();
        form.append('annotatedPdf', blob, 'annotated.pdf');
        const uploadRes = await api(`/api/reviewer/assignments/${id}/upload-annotated`, {
          method: 'POST',
          body: form,
        });
        annotatedPdfUrl = uploadRes.url || null;
      }
    } catch (uploadErr) {
      // Non-fatal: warn but continue — the reviewer's marks should still be saved
      console.warn('Annotated PDF upload failed:', uploadErr);
    } finally {
      setExportStatus('');
    }

    try {
      // Build questionMarks: distribute entered total marks evenly across questions,
      // or use 0 if no marks entered
      const totalEntered = marksAwarded !== '' ? Number(marksAwarded) : 0;
      const questions = data.assignment.questions || [];
      let questionMarks;
      if (questions.length > 0) {
        const base = Math.floor(totalEntered / questions.length);
        const rem = totalEntered - base * (questions.length - 1);
        questionMarks = questions.map((q, i) => ({
          questionId: q.id,
          marksAwarded: i === questions.length - 1 ? rem : base,
          feedback: '',
        }));
      } else {
        questionMarks = [{ questionId: 'overall', marksAwarded: totalEntered, feedback: '' }];
      }
      await api(`/api/reviewer/assignments/${id}/evaluate`, {
        method: 'POST',
        body: { feedback, questionMarks, annotatedPdfUrl, totalMarksOverride: totalEntered },
      });
      navigate('/reviewer/assignments');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // ── Loading / error states ───────────────────────────────────────────────────
  if (error && !data) {
    return (
      <div className="rev-shell">
        <div className="rev-topbar">
          <Link to="/reviewer/assignments" className="rev-back-btn">← Back</Link>
          <span className="rev-topbar-title">Review Submission</span>
        </div>
        <div style={{ padding: '2rem' }}>
          <p className="error">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rev-shell">
        <div className="rev-topbar">
          <Link to="/reviewer/assignments" className="rev-back-btn">← Back</Link>
          <span className="rev-topbar-title">Review Submission</span>
        </div>
        <div className="rev-loading">
          <div className="pdfan-spinner" />
          <p>Loading assignment…</p>
        </div>
      </div>
    );
  }

  const { assignment } = data;
  const completed = assignment.status === 'evaluated';

  // Build absolute URLs (needed for PDF.js cross-origin loading)
  function buildUrl(path) {
    if (!path) return null;
    const { protocol, hostname, port } = window.location;
    return `${protocol}//${hostname}${port ? ':' + port : ''}${path}`;
  }

  const answerUrl = buildUrl(assignment.answerFileUrl);
  const paperPdfUrl = buildUrl(assignment.pdfUrl);

  return (
    <div className="rev-shell">

      {/* ── Top bar ── */}
      <div className="rev-topbar">
        <Link to="/reviewer/assignments" className="rev-back-btn">← Assignments</Link>

        <div className="rev-topbar-info">
          <span className="rev-topbar-title">{assignment.paperTitle}</span>
        </div>

        {/* Tab toggle — both annotators remain mounted */}
        <div className="rev-view-toggle">
          <button
            className={`rev-toggle-btn${viewMode === 'answer' ? ' active' : ''}`}
            onClick={() => setViewMode('answer')}
          >
            Student Answer
          </button>
          {paperPdfUrl && (
            <button
              className={`rev-toggle-btn${viewMode === 'paper' ? ' active' : ''}`}
              onClick={() => setViewMode('paper')}
            >
              Question Paper
            </button>
          )}
        </div>

        <span
          className={`pill ${assignment.status}`}
          style={{ marginLeft: 'auto', flexShrink: 0 }}
        >
          {assignment.status}
        </span>
      </div>

      {/* ── Body ── */}
      <div className="rev-body">

        {/* Left: PDF panel — both annotators always mounted, only visibility toggles */}
        <div className="rev-pdf-panel">

          {/* Student answer (always in DOM) */}
          <div
            style={{
              display: viewMode === 'answer' ? 'flex' : 'none',
              flex: 1,
              flexDirection: 'column',
              minHeight: 0,
            }}
          >
            {answerUrl ? (
              <PDFAnnotator ref={answerAnnotatorRef} pdfUrl={answerUrl} />
            ) : (
              <div className="rev-no-pdf">
                <div style={{ fontSize: '3rem' }}></div>
                <h3>No answer uploaded</h3>
                <p className="muted">The student has not submitted an answer file.</p>
              </div>
            )}
          </div>

          {/* Question paper (always in DOM if available) */}
          {paperPdfUrl && (
            <div
              style={{
                display: viewMode === 'paper' ? 'flex' : 'none',
                flex: 1,
                flexDirection: 'column',
                minHeight: 0,
              }}
            >
              <PDFAnnotator pdfUrl={paperPdfUrl} />
            </div>
          )}

        </div>

        {/* Right: Evaluation panel — only overall feedback, not required */}
        <aside className="rev-eval-panel">
          <div className="rev-eval-scroll">
            <h3 className="rev-eval-heading">Evaluation</h3>

            {completed && (
              <div className="rev-already-done">
                This submission has already been evaluated.
              </div>
            )}

            <form className="form rev-eval-form" onSubmit={submit}>
              <label className="rev-marks-label">
                <span className="rev-marks-label-text">Marks Awarded</span>
                <div className="rev-marks-input-wrap">
                  <input
                    type="number"
                    min="0"
                    max={data?.assignment?.totalMarks || 9999}
                    step="0.5"
                    disabled={completed}
                    value={marksAwarded}
                    placeholder="e.g. 72"
                    onChange={(e) => setMarksAwarded(e.target.value)}
                    className="rev-marks-input"
                    style={{ color: '#000000' }}
                  />
                  {data?.assignment?.totalMarks && (
                    <span className="rev-marks-max">/ {data.assignment.totalMarks}</span>
                  )}
                </div>
                {completed && data?.evaluation?.totalMarks != null && (
                  <span className="rev-marks-scored">
                    Score: <strong>{data.evaluation.totalMarks}</strong>
                    {data?.assignment?.totalMarks ? ` / ${data.assignment.totalMarks}` : ''}
                  </span>
                )}
              </label>

              <label>
                Overall feedback
                <textarea
                  rows={7}
                  disabled={completed}
                  value={feedback}
                  placeholder="Write your feedback to the student… (optional)"
                  onChange={(e) => setFeedback(e.target.value)}
                />
              </label>

              {error && <p className="error">{error}</p>}

              {!completed && (
                <div className="rev-action-row">
                  {/* Save Draft */}
                  <button
                    type="button"
                    className="btn rev-draft-btn"
                    disabled={draftBusy || busy}
                    onClick={saveDraft}
                  >
                    {draftBusy ? 'Saving…' : 'Save draft'}
                  </button>

                  {/* Submit */}
                  <button className="btn primary rev-submit-btn" disabled={busy || draftBusy}>
                    {exportStatus === 'exporting'
                      ? 'Exporting PDF…'
                      : exportStatus === 'uploading'
                        ? 'Uploading…'
                        : busy
                          ? 'Submitting…'
                          : 'Submit evaluation'}
                  </button>
                </div>
              )}

              {/* Draft status message */}
              {draftMsg && (
                <div className={`rev-draft-toast ${draftMsg.ok ? 'ok' : 'err'}`}>
                  {draftMsg.ok ? '' : ''} {draftMsg.text}
                </div>
              )}

              {/* Last saved timestamp */}
              {lastSavedAt && !completed && (
                <p className="rev-draft-meta">
                  Last saved: {lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </form>
          </div>
        </aside>
      </div>
    </div>
  );
}
