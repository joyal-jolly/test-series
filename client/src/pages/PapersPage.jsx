import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PublicLayout } from '../components/Layouts';
import { api } from '../lib/api';

export default function PapersPage() {
  const [groups, setGroups] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [filters, setFilters] = useState({ q: '', caLevel: '', subjectId: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/api/papers/subjects').then((d) => setSubjects(d.subjects || []));
  }, []);

  useEffect(() => {
    setLoading(true);
    api('/api/papers/groups')
      .then((gd) => {
        setGroups(gd.groups || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const searchTerm = filters.q.toLowerCase().trim();

  // Filter groups
  const filteredGroups = groups.filter((g) => {
    const matchName = g.name?.toLowerCase().includes(searchTerm);
    const matchDesc = g.description?.toLowerCase().includes(searchTerm);

    // Check if any schedule papers match filters
    const allPapers = (g.schedules || []).flatMap((s) => s.papers || []);
    const matchingPapers = allPapers.filter((p) => {
      if (filters.caLevel && p.caLevel !== filters.caLevel) return false;
      if (filters.subjectId && p.subjectId !== filters.subjectId) return false;
      if (searchTerm) {
        const matchTitle = p.title?.toLowerCase().includes(searchTerm);
        const matchSubject = p.subjectName?.toLowerCase().includes(searchTerm);
        if (!matchTitle && !matchSubject) return false;
      }
      return true;
    });

    if (filters.caLevel || filters.subjectId) {
      return matchingPapers.length > 0;
    }

    if (searchTerm) {
      return matchName || matchDesc || matchingPapers.length > 0;
    }

    return true;
  });

  return (
    <PublicLayout>
      <section className="page-band">
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
          <select
            value={filters.subjectId}
            onChange={(e) => setFilters({ ...filters, subjectId: e.target.value })}
          >
            <option value="">All subjects</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="muted">Loading question paper groups…</p>
        ) : filteredGroups.length === 0 ? (
          <div className="panel" style={{ textAlign: 'center', padding: '3rem' }}>
            <p className="muted">No question paper groups match your filters.</p>
          </div>
        ) : (
          /* ── Responsive Grid of Compact Group Boxes ── */
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
              gap: '1.35rem',
            }}
          >
            {filteredGroups.map((g) => {
              const expectedSubjects = g.numSubjectsPerSchedule || 3;

              return (
                <Link
                  key={g.id}
                  to={`/groups/${g.id}`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '14px',
                    padding: '1.35rem 1.4rem',
                    textDecoration: 'none',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                    transition: 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
                    cursor: 'pointer',
                    position: 'relative',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-3px)';
                    e.currentTarget.style.borderColor = '#6366f1';
                    e.currentTarget.style.boxShadow =
                      '0 10px 25px -5px rgba(99, 102, 241, 0.16), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.04)';
                  }}
                >
                  <div>
                    {/* Header: Title & Schedule Details on Left, 2 Price Circles on Right */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '0.75rem',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Group Title Name */}
                        <h3
                          style={{
                            margin: 0,
                            fontSize: '1.18rem',
                            fontWeight: 700,
                            color: '#0f172a',
                            lineHeight: 1.3,
                            letterSpacing: '-0.01em',
                            wordBreak: 'break-word',
                          }}
                        >
                          {g.name}
                        </h3>

                        {/* Details of the schedule directly under group title name */}
                        <div
                          style={{
                            marginTop: '0.4rem',
                            fontSize: '0.86rem',
                            fontWeight: 600,
                            color: '#4f46e5',
                            letterSpacing: '-0.01em',
                          }}
                        >
                          {g.numSchedules} Schedules · {expectedSubjects} Subjects per Schedule
                        </div>
                      </div>

                      {/* Top Right: 2 badges (100 Rs in dim colour, Free in lighter green oval, no hover effect) */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          flexShrink: 0,
                          pointerEvents: 'none',
                        }}
                      >
                        {/* Circle 1: 100 Rs (Dim colour) */}
                        <div
                          style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            background: '#f1f5f9',
                            border: '1.5px solid #cbd5e1',
                            color: '#94a3b8',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            textDecoration: 'line-through',
                            userSelect: 'none',
                            transition: 'none',
                          }}
                          title="Original Price: 100 Rs"
                        >
                          100 Rs
                        </div>

                        {/* Badge 2: Free (Lighter green colour, oval shape, no hover effect) */}
                        <div
                          style={{
                            width: '54px',
                            height: '32px',
                            borderRadius: '50%',
                            background: '#dcfce7',
                            border: '1.5px solid #86efac',
                            color: '#15803d',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.78rem',
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
                    </div>

                    {/* Optional description snippet */}
                    {g.description && (
                      <p
                        className="muted"
                        style={{
                          margin: '0.65rem 0 0',
                          fontSize: '0.83rem',
                          lineHeight: 1.45,
                          color: '#64748b',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {g.description}
                      </p>
                    )}
                  </div>

                  {/* Card Bottom: Instead of "no. schedules created" and "open group", show "Purchase this" */}
                  <div
                    style={{
                      marginTop: '1.25rem',
                      paddingTop: '0.85rem',
                      borderTop: '1px solid #f1f5f9',
                    }}
                  >
                    <div
                      style={{
                        width: '100%',
                        background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                        color: '#ffffff',
                        borderRadius: '10px',
                        padding: '0.58rem 1rem',
                        fontSize: '0.88rem',
                        fontWeight: 700,
                        textAlign: 'center',
                        boxShadow: '0 2px 8px rgba(79, 70, 229, 0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem',
                        transition: 'none',
                      }}
                    >
                      Purchase this →
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </PublicLayout>
  );
}
