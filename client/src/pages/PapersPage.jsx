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
        <p style={{ textAlign: 'center', color: 'var(--ink-soft)', lineHeight: 1.6, margin: '0 0 1.5rem' }}>
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
      navigate(`/login?next=/groups/${group.id}`);
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
    const groupLevel = g.caLevel || 'Intermediate';
    if (filters.caLevel && groupLevel !== filters.caLevel) {
      return false;
    }

    const allPapers = (g.schedules || []).flatMap((s) => s.papers || []);
    if (filters.subjectId) {
      const hasSubject = allPapers.some((p) => p.subjectId === filters.subjectId);
      if (!hasSubject) return false;
    }

    if (searchTerm) {
      const matchesGroup =
        g.name?.toLowerCase().includes(searchTerm) ||
        g.description?.toLowerCase().includes(searchTerm) ||
        groupLevel.toLowerCase().includes(searchTerm);
      const matchesPaper = allPapers.some(
        (p) =>
          p.title?.toLowerCase().includes(searchTerm) ||
          p.subjectName?.toLowerCase().includes(searchTerm)
      );
      if (!matchesGroup && !matchesPaper) return false;
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

        <div className="papers-header">
          <div className="papers-eyebrow-pill">
            <span className="papers-eyebrow-dot" aria-hidden="true" />
            <span>MENTAURA CA CAMPUS</span>
            <span className="dot">•</span>
            <span>VAZHAKULAM</span>
          </div>
          <h1 className="papers-main-title">Question Paper Library</h1>
         
          <p className="papers-lede">
            Select a question paper group below to view its schedules and attempt uploaded question papers with faculty evaluation.
          </p>
        </div>

        <div className="papers-filter-row">
          <div className="papers-search-wrap">
            <svg
              className="papers-search-icon"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search group, title, subject…"
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
              className="papers-search-input"
            />
          </div>
          <div className="papers-select-group">
            <select
              value={filters.caLevel}
              onChange={(e) => setFilters({ ...filters, caLevel: e.target.value })}
              className="papers-select"
            >
              <option value="">All levels</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Final">Final</option>
            </select>
            <select
              value={filters.subjectId}
              onChange={(e) => setFilters({ ...filters, subjectId: e.target.value })}
              className="papers-select"
            >
              <option value="">All subjects</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <p className="muted" style={{ textAlign: 'center', padding: '3rem 0' }}>Loading question paper groups…</p>
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
          <div className="papers-cards-grid">
            {filteredGroups.map((g) => {
              const expectedSubjects = g.numSubjectsPerSchedule || 3;
              const enrolled = isStudent && enrolledIds.has(g.id);

              return (
                <div
                  key={g.id}
                  className={`paper-group-card ${enrolled ? 'enrolled' : ''}`}
                  onClick={() => {
                    if (!user) {
                      navigate(`/login?next=/groups/${g.id}`);
                      return;
                    }
                    navigate(`/groups/${g.id}`);
                  }}
                >
                  <div className="paper-card-body">
                    {/* Header row with badges */}
                    <div className="paper-card-head">
                      <span className={`paper-level-badge ${g.caLevel === 'Final' ? 'final' : 'intermediate'}`}>
                        {g.caLevel === 'Final' ? 'CA Final' : 'CA Intermediate'}
                      </span>

                      {/* Price badges */}
                      <div className="paper-pricing">
                        <span className="paper-original-price">100 Rs</span>
                        <span className="paper-free-badge">FREE</span>
                      </div>
                    </div>

                    <h3 className="paper-group-name">{g.name}</h3>
                    <div className="paper-group-meta">
                      {g.numSchedules} Schedules · {expectedSubjects} Subjects per Schedule
                    </div>

                    {g.description && (
                      <p className="paper-group-description">
                        {g.description}
                      </p>
                    )}
                  </div>

                  {/* Bottom CTA */}
                  <div className="paper-card-action">
                    {enrolled ? (
                      <button
                        type="button"
                        className="paper-attempt-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/groups/${g.id}`);
                        }}
                      >
                        Attempt →
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="paper-purchase-btn"
                        onClick={(e) => handlePurchaseClick(e, g)}
                      >
                        Purchase →
                      </button>
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
