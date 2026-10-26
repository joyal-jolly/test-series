import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PublicLayout } from '../components/Layouts';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

// ─── localStorage helpers ─────────────────────────────────────────────────────
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

// ─── Confirmation Modal ───────────────────────────────────────────────────────
function PurchaseModal({ groupName, onConfirm, onCancel, busy }) {
  return (
    <div
      className="modal-overlay"
      onClick={() => !busy && onCancel()}
    >
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 460 }}
      >
        <div
          className="modal-badge"
          style={{ background: '#dcfce7', color: '#15803d' }}
        >
          🎓 Free Access
        </div>
        <h2 className="modal-title">Confirm Enrollment</h2>
        <p style={{ textAlign: 'center', color: '#475569', lineHeight: 1.6, margin: '0 0 1.5rem' }}>
          Purchase <strong>"{groupName}"</strong> for <strong>free</strong>?<br />
          Once enrolled you can attempt all question papers in this series.
        </p>
        <div className="modal-actions">
          <button
            type="button"
            className="btn ghost"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn primary lg"
            onClick={onConfirm}
            disabled={busy}
            style={{ background: '#15803d', minWidth: 160 }}
          >
            {busy ? 'Enrolling…' : '✓ Yes, Enroll for Free'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PapersPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [groups, setGroups] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [filters, setFilters] = useState({ q: '', caLevel: '', subjectId: '' });
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  // Set of enrolled group IDs for this student
  const [enrolledIds, setEnrolledIds] = useState(() => new Set());

  // Purchase modal target
  const [purchaseTarget, setPurchaseTarget] = useState(null); // { id, name }
  const [enrollBusy, setEnrollBusy] = useState(false);

  // ── Load groups ──────────────────────────────────────────────────────────────
  function loadGroups() {
    setLoading(true);
    setFetchError('');
    api('/api/papers/groups')
      .then((d) => setGroups(d.groups || []))
      .catch((err) => setFetchError(err.message || 'Failed to load groups'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    api('/api/papers/subjects').then((d) => setSubjects(d.subjects || [])).catch(() => {});
  }, []);

  useEffect(() => { loadGroups(); }, []);

  // ── Sync enrollments ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || user.role !== 'student') return;
    // Load from localStorage immediately
    const local = getEnrolled(user.id);
    if (local.length) setEnrolledIds(new Set(local));
    // Sync from server
    api('/api/student/enrollments')
      .then((d) => {
        const ids = d.enrolledGroupIds || [];
        ids.forEach((gid) => saveEnrolled(user.id, gid));
        setEnrolledIds(new Set([...local, ...ids]));
      })
      .catch(() => { /* localStorage is enough */ });
  }, [user]);

  // ── Purchase handlers ────────────────────────────────────────────────────────
  function handlePurchaseClick(e, group) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      navigate('/login?next=/papers');
      return;
    }
    if (user.role !== 'student') return;
    if (enrolledIds.has(group.id)) {
      navigate(`/groups/${group.id}`);
      return;
    }
    setPurchaseTarget({ id: group.id, name: group.name });
  }

  async function confirmPurchase() {
    if (!purchaseTarget || !user) return;
    setEnrollBusy(true);
    try {
      await api(`/api/student/enroll/${purchaseTarget.id}`, { method: 'POST' });
    } catch { /* non-fatal — localStorage persists it */ }
    saveEnrolled(user.id, purchaseTarget.id);
    setEnrolledIds((prev) => new Set([...prev, purchaseTarget.id]));
    const targetId = purchaseTarget.id;
    setPurchaseTarget(null);
    setEnrollBusy(false);
    navigate(`/groups/${targetId}`);
  }

  // ── Filtering ────────────────────────────────────────────────────────────────
  const searchTerm = filters.q.toLowerCase().trim();
  const filteredGroups = groups.filter((g) => {
    const allPapers = (g.schedules || []).flatMap((s) => s.papers || []);
    const matchingPapers = allPapers.filter((p) => {
      if (filters.caLevel && p.caLevel !== filters.caLevel) return false;
      if (filters.subjectId && p.subjectId !== filters.subjectId) return false;
      if (searchTerm) {
        if (!p.title?.toLowerCase().includes(searchTerm) &&
            !p.subjectName?.toLowerCase().includes(searchTerm)) return false;
      }
      return true;
    });
    if (filters.caLevel || filters.subjectId) return matchingPapers.length > 0;
    if (searchTerm) {
      return g.name?.toLowerCase().includes(searchTerm) ||
             g.description?.toLowerCase().includes(searchTerm) ||
             matchingPapers.length > 0;
    }
    return true;
  });

  const isStudent = user?.role === 'student';

  return (
    <PublicLayout>
      <section className="page-band">

        {/* ── Purchase Modal ── */}
        {purchaseTarget && (
          <PurchaseModal
            groupName={purchaseTarget.name}
            onConfirm={confirmPurchase}
            onCancel={() => !enrollBusy && setPurchaseTarget(null)}
            busy={enrollBusy}
          />
        )}

        <div className="section-head">
          <h1>Question paper library</h1>
          <p>Select a question paper group below to view its schedules and attempt uploaded question papers.</p>
        </div>

        <div className="filters">
          <input
            placeholder="Search group, title, subject…"
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
          />
          <select value={filters.caLevel} onChange={(e) => setFilters({ ...filters, caLevel: e.target.value })}>
            <option value="">All levels</option>
            <option>Intermediate</option>
            <option>Final</option>
          </select>
          <select value={filters.subjectId} onChange={(e) => setFilters({ ...filters, subjectId: e.target.value })}>
            <option value="">All subjects</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="muted">Loading question paper groups…</p>
        ) : fetchError ? (
          <div className="panel" style={{ textAlign: 'center', padding: '3rem' }}>
            <p className="error">{fetchError}</p>
            <button className="btn ghost" style={{ marginTop: '1rem' }} onClick={loadGroups}>
              Retry
            </button>
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="panel" style={{ textAlign: 'center', padding: '3rem' }}>
            <p className="muted">No question paper groups match your filters.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '1.35rem' }}>
            {filteredGroups.map((g) => {
              const expectedSubjects = g.numSubjectsPerSchedule || 3;
              const enrolled = isStudent && enrolledIds.has(g.id);

              return (
                <div
                  key={g.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    background: '#ffffff',
                    border: enrolled ? '1.5px solid #86efac' : '1px solid #e2e8f0',
                    borderRadius: '14px',
                    padding: '1.35rem 1.4rem',
                    textDecoration: 'none',
                    boxShadow: enrolled ? '0 2px 12px rgba(21,128,61,0.10)' : '0 2px 8px rgba(0,0,0,0.04)',
                    transition: 'all 0.22s cubic-bezier(0.4,0,0.2,1)',
                    cursor: 'pointer',
                    position: 'relative',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-3px)';
                    e.currentTarget.style.borderColor = enrolled ? '#4ade80' : '#6366f1';
                    e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(99,102,241,0.16)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.borderColor = enrolled ? '#86efac' : '#e2e8f0';
                    e.currentTarget.style.boxShadow = enrolled
                      ? '0 2px 12px rgba(21,128,61,0.10)'
                      : '0 2px 8px rgba(0,0,0,0.04)';
                  }}
                  onClick={() => navigate(`/groups/${g.id}`)}
                >
                  <div>
                    {/* Header row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={{ margin: 0, fontSize: '1.18rem', fontWeight: 700, color: '#0f172a', lineHeight: 1.3, letterSpacing: '-0.01em', wordBreak: 'break-word' }}>
                          {g.name}
                        </h3>
                        <div style={{ marginTop: '0.3rem', fontSize: '0.66rem', fontWeight: 500, color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {g.numSchedules} Schedules · {expectedSubjects} Subjects per Schedule
                        </div>
                      </div>

                      {/* Price badges (non-interactive) */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0, pointerEvents: 'none' }}>
                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#f1f5f9', border: '1.5px solid #cbd5e1', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700, textDecoration: 'line-through', userSelect: 'none' }} title="Original Price: 100 Rs">
                          100 Rs
                        </div>
                        <div style={{ width: 54, height: 32, borderRadius: 999, background: '#dcfce7', color: '#1aa34d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.02em', userSelect: 'none' }}>
                          Free
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    {g.description && (
                      <p className="muted" style={{ margin: '0.65rem 0 0', fontSize: '0.83rem', lineHeight: 1.45, color: '#64748b', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {g.description}
                      </p>
                    )}
                  </div>

                  {/* Bottom CTA */}
                  <div style={{ marginTop: '1.25rem', paddingTop: '0.85rem', borderTop: '1px solid #f1f5f9' }}>
                    {enrolled ? (
                      /* Already enrolled → Attempt */
                      <div
                        style={{ width: '100%', background: 'linear-gradient(135deg,#15803d,#16a34a)', color: '#fff', borderRadius: '10px', padding: '0.58rem 1rem', fontSize: '0.88rem', fontWeight: 700, textAlign: 'center', boxShadow: '0 2px 8px rgba(21,128,61,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', cursor: 'pointer' }}
                        onClick={(e) => { e.stopPropagation(); navigate(`/groups/${g.id}`); }}
                      >
                        Attempt →
                      </div>
                    ) : (
                      /* Not enrolled → Purchase This */
                      <div
                        style={{ width: '100%', background: 'linear-gradient(135deg,#110e4a,#4c4c4e)', color: '#fff', borderRadius: '10px', padding: '0.58rem 1rem', fontSize: '0.88rem', fontWeight: 700, textAlign: 'center', boxShadow: '0 2px 8px rgba(79,70,229,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', cursor: 'pointer' }}
                        onClick={(e) => handlePurchaseClick(e, g)}
                      >
                        Purchase
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </PublicLayout>
  );
}
