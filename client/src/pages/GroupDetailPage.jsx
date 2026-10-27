import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { PublicLayout } from '../components/Layouts';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

// ─── localStorage helpers (same key as PapersPage) ───────────────────────────
const LS_KEY = 'mentaura_enrolled_groups';
const LS_EXEMPTIONS_KEY = 'mentaura_subject_exemptions';

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

function getExemptions(userId, groupId) {
  try {
    const raw = localStorage.getItem(LS_EXEMPTIONS_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return (data[userId] && data[userId][groupId]) || [];
  } catch { return []; }
}
function saveExemptions(userId, groupId, subjectIds) {
  try {
    const raw = localStorage.getItem(LS_EXEMPTIONS_KEY);
    const data = raw ? JSON.parse(raw) : {};
    if (!data[userId]) data[userId] = {};
    data[userId][groupId] = subjectIds;
    localStorage.setItem(LS_EXEMPTIONS_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
}

function formatScheduleDateTime(iso) {
  if (!iso) return 'Immediately available';
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short', year: 'numeric', month: 'short',
    day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ─── Exemption Selection Modal ───────────────────────────────────────────────
function ExemptionModal({ subjects, initialSelected, onConfirm, onCancel }) {
  const [selected, setSelected] = useState(() => new Set(initialSelected));

  function toggle(subjectId) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(subjectId)) {
        next.delete(subjectId);
      } else {
        next.add(subjectId);
      }
      return next;
    });
  }

  function handleSelectAll() {
    if (selected.size === subjects.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(subjects.map((s) => s.id)));
    }
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <div className="modal-badge" style={{ background: '#ede9fe', color: '#6366f1', border: '1px solid #c7d2fe' }}>
          Exemption Management
        </div>
        <h2 className="modal-title" style={{ marginBottom: '0.35rem' }}>Subject Exemptions</h2>
        <p className="muted" style={{ fontSize: '0.88rem', lineHeight: 1.5, margin: '0 0 1.25rem' }}>
          Select the subjects you have scored an exemption in. Question papers for exempted subjects will display as <strong>Exemption</strong> and you will not be required to attempt them.
        </p>

        {subjects.length === 0 ? (
          <p className="muted" style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            No subjects found for this group.
          </p>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b' }}>
                {selected.size} of {subjects.length} subjects exempted
              </span>
              <button
                type="button"
                onClick={handleSelectAll}
                style={{ background: 'none', border: 'none', color: '#4f46e5', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}
              >
                {selected.size === subjects.length ? 'Clear All' : 'Select All'}
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', maxHeight: '320px', overflowY: 'auto', paddingRight: '0.25rem' }}>
              {subjects.map((s) => {
                const isChecked = selected.has(s.id);
                return (
                  <label
                    key={s.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.85rem',
                      padding: '0.75rem 1rem',
                      borderRadius: '10px',
                      border: isChecked ? '1.5px solid #6366f1' : '1px solid #e2e8f0',
                      background: isChecked ? '#f5f3ff' : '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      userSelect: 'none',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggle(s.id)}
                      style={{ width: '1.15rem', height: '1.15rem', accentColor: '#4f46e5', cursor: 'pointer' }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.92rem', color: isChecked ? '#4338ca' : '#0f172a' }}>
                        {s.name}
                      </div>
                      {s.caLevel && (
                        <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                          {s.caLevel}
                        </span>
                      )}
                    </div>
                    {isChecked && (
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4338ca', background: '#e0e7ff', padding: '0.2rem 0.55rem', borderRadius: '6px' }}>
                        Exempted
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        )}

        <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
          <button type="button" className="btn ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn primary lg"
            onClick={() => onConfirm(Array.from(selected))}
          >
            Confirm Exemptions
          </button>
        </div>
      </div>
    </div>
  );
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
function PaperButton({ paperId, isAvailable, enrolled, paperAttempts, onAttemptClick, navigate, isExempted }) {
  if (isExempted) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.35rem',
          fontSize: '0.82rem',
          padding: '0.42rem 1rem',
          background: '#f1f5f9',
          color: '#475569',
          border: '1.5px solid #cbd5e1',
          borderRadius: '8px',
          fontWeight: 700,
          cursor: 'default',
          userSelect: 'none',
        }}
        title="This subject is marked as exempted"
      >
        Exemption
      </span>
    );
  }

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
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [enrolled, setEnrolled] = useState(false);
  const [paperAttempts, setPaperAttempts] = useState({}); // { paperId: { attemptId, status } }
  const [now, setNow] = useState(() => Date.now());

  // Exemption state
  const [exemptedSubjectIds, setExemptedSubjectIds] = useState(() => new Set(getExemptions(user?.id, id)));
  const [showExemptionModal, setShowExemptionModal] = useState(false);
  const [allSubjects, setAllSubjects] = useState([]);

  // Attempt modal
  const [selectedPaperId, setSelectedPaperId] = useState(null);
  const [attemptBusy, setAttemptBusy] = useState(false);
  const [attemptError, setAttemptError] = useState('');

  // Protect route: require login to view group details
  useEffect(() => {
    if (!authLoading && !user) {
      navigate(`/login?next=/groups/${id}`, { replace: true });
    }
  }, [user, authLoading, id, navigate]);

  // ── Fetch all subjects for exemption list ─────────────────────────────────
  useEffect(() => {
    api('/api/papers/subjects')
      .then((d) => setAllSubjects(d.subjects || []))
      .catch(() => { });
  }, []);

  // ── Fetch group ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    api(`/api/papers/groups/${id}`)
      .then((d) => setGroup(d.group))
      .catch((err) => setError(err.message || 'Failed to load group details'))
      .finally(() => setLoading(false));
  }, [id, user]);

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
      .catch(() => { });
  }, [user, id]);

  // ── Sync exemptions ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || user.role !== 'student') return;
    const local = getExemptions(user.id, id);
    if (local.length) setExemptedSubjectIds(new Set(local));
    api(`/api/student/exemptions/${id}`)
      .then((d) => {
        if (Array.isArray(d?.subjectIds)) {
          saveExemptions(user.id, id, d.subjectIds);
          setExemptedSubjectIds(new Set(d.subjectIds));
        }
      })
      .catch(() => { });
  }, [user, id]);

  // ── Fetch per-paper attempt statuses ──────────────────────────────────────
  const loadAttempts = useCallback(() => {
    if (!user || user.role !== 'student') return;
    api('/api/student/paper-attempts')
      .then((d) => setPaperAttempts(d.paperAttempts || {}))
      .catch(() => { });
  }, [user]);

  useEffect(() => { loadAttempts(); }, [loadAttempts]);

  // ── Compute group subjects for exemption selection ─────────────────────────
  const groupSubjects = useMemo(() => {
    const level = group?.caLevel || 'Intermediate';

    // If allSubjects are loaded, filter subjects matching the group's CA level
    if (allSubjects && allSubjects.length > 0) {
      const filtered = allSubjects.filter((s) => s.caLevel === level);
      if (filtered.length > 0) {
        return filtered.sort((a, b) => a.name.localeCompare(b.name));
      }
    }

    // Fallback: collect from uploaded papers or allSubjects
    const map = new Map();
    if (group?.schedules) {
      group.schedules.forEach((s) => {
        (s.papers || []).forEach((p) => {
          if (p.subjectId && !map.has(p.subjectId)) {
            map.set(p.subjectId, {
              id: p.subjectId,
              name: p.subjectName || 'Unknown Subject',
              caLevel: p.caLevel || level,
            });
          }
        });
      });
    }
    if (map.size === 0 && allSubjects.length > 0) {
      allSubjects.forEach((s) => map.set(s.id, { id: s.id, name: s.name, caLevel: s.caLevel }));
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [group, allSubjects]);

  // ── Exemption handlers ─────────────────────────────────────────────────────
  async function handleConfirmExemptions(selectedIds) {
    setExemptedSubjectIds(new Set(selectedIds));
    saveExemptions(user?.id, id, selectedIds);
    setShowExemptionModal(false);
    try {
      await api(`/api/student/exemptions/${id}`, {
        method: 'POST',
        body: { subjectIds: selectedIds },
      });
    } catch {
      /* non-fatal fallback */
    }
  }

  // ── Attempt handlers ───────────────────────────────────────────────────────
  function handleAttemptClick(paperId) {
    if (!user) { navigate(`/login?next=/groups/${id}`); return; }
    const paper = group?.schedules?.flatMap((s) => s.papers || []).find((p) => p.id === paperId);
    if (paper && exemptedSubjectIds.has(paper.subjectId)) {
      return;
    }
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

  // ── Authentication Guard ───────────────────────────────────────────────────
  if (authLoading || !user) {
    return (
      <PublicLayout>
        <section className="page-band" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
          <p className="muted">Please log in to view question paper group details…</p>
        </section>
      </PublicLayout>
    );
  }

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

        {/* ── Exemption Modal ── */}
        {showExemptionModal && (
          <ExemptionModal
            subjects={groupSubjects}
            initialSelected={Array.from(exemptedSubjectIds)}
            onConfirm={handleConfirmExemptions}
            onCancel={() => setShowExemptionModal(false)}
          />
        )}

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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                <span
                  className="pill"
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    background: group.caLevel === 'Final' ? '#fdf2f8' : '#eff6ff',
                    color: group.caLevel === 'Final' ? '#be185d' : '#1d4ed8',
                    border: group.caLevel === 'Final' ? '1.5px solid #fbcfe8' : '1.5px solid #bfdbfe',
                    borderRadius: '8px',
                    padding: '0.22rem 0.75rem',
                  }}
                >
                  {group.caLevel === 'Final' ? 'CA Final' : 'CA Intermediate'}
                </span>
              </div>
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

            {/* Price + exemption / enrollment badge */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.65rem', minWidth: 160 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: 46, height: 46, borderRadius: '50%', background: '#f1f5f9', border: '1.5px solid #cbd5e1', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.74rem', fontWeight: 700, textDecoration: 'line-through', userSelect: 'none' }}>100 Rs</div>
                <div style={{ width: 60, height: 34, borderRadius: 999, background: '#dcfce7', border: '1.5px solid #86efac', color: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', userSelect: 'none' }}>Free</div>
              </div>
              {isStudent && enrolled && (
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => setShowExemptionModal(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    borderRadius: 999,
                    padding: '0.48rem 1.25rem',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(79,70,229,0.25)',
                    whiteSpace: 'nowrap',
                  }}
                  title="Add or manage subject exemptions"
                >
                  {exemptedSubjectIds.size > 0
                    ? `Add Exemption (${exemptedSubjectIds.size})`
                    : 'Add Exemption'}
                </button>
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
                              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
                                <strong style={{ fontSize: '0.98rem', color: '#0f172a' }}>{p.subjectName}</strong>
                                {exemptedSubjectIds.has(p.subjectId) && (
                                  <span
                                    className="pill"
                                    style={{
                                      background: '#ede9fe',
                                      color: '#6366f1',
                                      fontSize: '0.72rem',
                                      fontWeight: 700,
                                      border: '1px solid #c7d2fe',
                                    }}
                                  >
                                    Exemption
                                  </span>
                                )}
                              </div>
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
                                  isExempted={exemptedSubjectIds.has(p.subjectId)}
                                />
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
