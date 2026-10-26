import { useEffect, useState } from 'react';
import { PortalLayout } from '../components/Layouts';
import { api } from '../lib/api';

export function AdminPortalLayout({ children, unassignedCount }) {
  const [pendingCount, setPendingCount] = useState(
    typeof unassignedCount === 'number' ? unassignedCount : 0
  );

  useEffect(() => {
    if (typeof unassignedCount === 'number') {
      setPendingCount(unassignedCount);
    } else {
      api('/api/admin/dashboard')
        .then((d) => {
          if (d?.pendingAssignments != null) {
            setPendingCount(d.pendingAssignments);
          }
        })
        .catch(() => { });
    }
  }, [unassignedCount]);

  const links = [
    { to: '/admin', label: 'Dashboard', end: true },
    { to: '/admin/papers', label: 'Question papers' },
    {
      to: '/admin/submissions',
      label: 'Assign reviews',
      badge: pendingCount > 0 ? pendingCount : null,
    },
    { to: '/admin/users', label: 'Users' },
    { to: '/admin/insights', label: 'Insights' },
  ];

  return (
    <PortalLayout title="Admin portal" links={links}>
      {children}
    </PortalLayout>
  );
}

export function AdminDashboard() {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    api('/api/admin/dashboard').then(setStats);
  }, []);

  return (
    <AdminPortalLayout unassignedCount={stats?.pendingAssignments}>
      {!stats ? (
        <p className="muted">Loading…</p>
      ) : (
        <>
          <div className="stats-grid">
            {[
              ['Students', stats.students],
              ['Reviewers', stats.reviewers],
              ['Question papers', stats.questionPapers],
              ['Total submissions', stats.totalSubmissions],
              ['Pending reviews', stats.pendingReviews],
              ['Completed reviews', stats.completedReviews],
              ["Today's submissions", stats.todaysSubmissions],
              ['Pending assignments', stats.pendingAssignments],
            ].map(([label, value]) => (
              <div className="stat-tile" key={label}>
                <strong>{value}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>

          {/* Assigned but not yet evaluated */}
          {stats.assignedPending && stats.assignedPending.length > 0 && (
            <div className="panel" style={{ marginTop: '1.5rem' }}>
              <div className="panel-head">
                <h2>Assigned &ndash; Pending evaluation</h2>
                <span className="pill assigned" style={{ fontSize: '0.8rem' }}>
                  {stats.assignedPending.length} pending
                </span>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Paper</th>
                    <th>Reviewer</th>
                    <th>Assigned</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.assignedPending.map((s) => (
                    <tr key={s.id}>
                      <td>{s.studentName}</td>
                      <td>{s.paperTitle}</td>
                      <td>{s.reviewerName}</td>
                      <td>{s.assignedAt ? new Date(s.assignedAt).toLocaleString() : '\u2014'}</td>
                      <td>
                        <span className={`pill ${s.status}`}>{s.status.replace('_', ' ')}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </AdminPortalLayout>
  );
}

// ─── Helper: format datetime-local value ──────────────────────────────────
function toDateTimeLocal(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatScheduleDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function scheduleStatusPill(sched) {
  if (!sched || !sched.paper) {
    return <span className="pill draft">Pending</span>;
  }
  const isFuture = sched.paper.availableAt && new Date(sched.paper.availableAt) > new Date();
  if (isFuture) {
    return <span className="pill assigned">Scheduled</span>;
  }
  return <span className="pill published">Uploaded</span>;
}

// ─── Admin Papers: Group → Schedule → Multi-Subject Paper Management ─────
export function AdminPapers() {
  const [groups, setGroups] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [loading, setLoading] = useState(true);

  // Create group form
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupForm, setGroupForm] = useState({
    name: '',
    description: '',
    numSchedules: 5,
    numSubjectsPerSchedule: 3,
  });
  const [groupError, setGroupError] = useState('');
  const [groupMessage, setGroupMessage] = useState('');

  // Edit group modal
  const [editingGroup, setEditingGroup] = useState(null);
  const [editGroupError, setEditGroupError] = useState('');

  // Schedule Date/Time modal (shared date & time for the whole schedule)
  const [scheduleDateModal, setScheduleDateModal] = useState(null);
  const [scheduleDateForm, setScheduleDateForm] = useState({ availableDate: '', availableTime: '' });
  const [scheduleDateError, setScheduleDateError] = useState('');
  const [scheduleDateLoading, setScheduleDateLoading] = useState(false);

  // Upload/edit paper modal for a schedule slot
  const [paperModal, setPaperModal] = useState(null);
  const [paperForm, setPaperForm] = useState({
    title: '',
    subjectId: '',
    caLevel: 'Intermediate',
    paperType: 'Group 1',
    chapter: '',
    totalMarks: 100,
    durationMinutes: 180,
  });
  const [paperPdf, setPaperPdf] = useState(null);
  const [paperError, setPaperError] = useState('');
  const [paperLoading, setPaperLoading] = useState(false);

  function reload() {
    setLoading(true);
    api('/api/admin/groups')
      .then((gd) => {
        setGroups(gd.groups || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    reload();
    api('/api/papers/subjects').then((d) => {
      setSubjects(d.subjects || []);
    });
  }, []);

  // ── Create Group ──
  async function createGroup(e) {
    e.preventDefault();
    setGroupError('');
    setGroupMessage('');
    try {
      await api('/api/admin/groups', {
        method: 'POST',
        body: {
          name: groupForm.name,
          description: groupForm.description,
          numSchedules: Number(groupForm.numSchedules),
          numSubjectsPerSchedule: Number(groupForm.numSubjectsPerSchedule),
        },
      });
      setGroupMessage('Group created successfully.');
      setGroupForm({ name: '', description: '', numSchedules: 5, numSubjectsPerSchedule: 3 });
      setShowCreateGroup(false);
      reload();
    } catch (err) {
      setGroupError(err.message);
    }
  }

  // ── Delete Group ──
  async function deleteGroup(id) {
    if (!window.confirm('Delete this group? Question papers inside will be unlinked.')) return;
    try {
      await api(`/api/admin/groups/${id}`, { method: 'DELETE' });
      reload();
    } catch (err) {
      alert(err.message);
    }
  }

  // ── Save Edit Group ──
  async function saveEditGroup(e) {
    e.preventDefault();
    setEditGroupError('');
    try {
      await api(`/api/admin/groups/${editingGroup.id}`, {
        method: 'PATCH',
        body: {
          name: editingGroup.name,
          description: editingGroup.description,
          numSchedules: Number(editingGroup.numSchedules),
          numSubjectsPerSchedule: Number(editingGroup.numSubjectsPerSchedule),
        },
      });
      setEditingGroup(null);
      reload();
    } catch (err) {
      setEditGroupError(err.message);
    }
  }

  // ── Open Schedule Date/Time Modal ──
  function openScheduleDateModal(groupId, groupName, scheduleNumber, availableAt) {
    let dStr = '';
    let tStr = '';
    if (availableAt) {
      const d = new Date(availableAt);
      const pad = (n) => String(n).padStart(2, '0');
      dStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      tStr = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    setScheduleDateForm({ availableDate: dStr, availableTime: tStr });
    setScheduleDateError('');
    setScheduleDateModal({ groupId, groupName, scheduleNumber });
  }

  // ── Save Schedule Date/Time ──
  async function saveScheduleDate(e) {
    e.preventDefault();
    setScheduleDateError('');
    setScheduleDateLoading(true);
    try {
      let iso = null;
      if (scheduleDateForm.availableDate) {
        const timeStr = scheduleDateForm.availableTime || '00:00';
        iso = new Date(`${scheduleDateForm.availableDate}T${timeStr}:00`).toISOString();
      }

      await api(`/api/admin/groups/${scheduleDateModal.groupId}/schedules/${scheduleDateModal.scheduleNumber}`, {
        method: 'PATCH',
        body: { availableAt: iso },
      });

      setScheduleDateModal(null);
      reload();
    } catch (err) {
      setScheduleDateError(err.message);
    } finally {
      setScheduleDateLoading(false);
    }
  }

  // ── Open Paper Modal (Upload or Edit) ──
  function openPaperModal(groupId, groupName, scheduleNumber, existingPaper, scheduleAvailableAt, existingPapers = []) {
    if (existingPaper) {
      setPaperForm({
        title: existingPaper.title || '',
        subjectId: existingPaper.subjectId || subjects[0]?.id || '',
        caLevel: existingPaper.caLevel || 'Intermediate',
        paperType: existingPaper.paperType || 'Group 1',
        chapter: existingPaper.chapter || '',
        totalMarks: existingPaper.totalMarks || 100,
        durationMinutes: existingPaper.durationMinutes || 180,
      });
    } else {
      // Find the first subject not yet uploaded in this schedule
      const usedSubjectIds = (existingPapers || []).map((p) => p.subjectId);
      const nextAvailableSubject = subjects.find((s) => !usedSubjectIds.includes(s.id)) || subjects[0];

      setPaperForm({
        title: nextAvailableSubject ? `Schedule ${scheduleNumber} - ${nextAvailableSubject.name}` : `Schedule ${scheduleNumber} Paper`,
        subjectId: nextAvailableSubject?.id || subjects[0]?.id || '',
        caLevel: 'Intermediate',
        paperType: 'Group 1',
        chapter: '',
        totalMarks: 100,
        durationMinutes: 180,
      });
    }
    setPaperPdf(null);
    setPaperError('');
    setPaperModal({
      groupId,
      groupName,
      scheduleNumber,
      existingPaper: existingPaper || null,
      scheduleAvailableAt,
      existingPapers: existingPapers || [],
    });
  }

  // ── Save Paper ──
  async function savePaper(e) {
    e.preventDefault();
    setPaperError('');
    setPaperLoading(true);
    try {
      const body = new FormData();
      body.append('title', paperForm.title);
      body.append('subjectId', paperForm.subjectId);
      body.append('caLevel', paperForm.caLevel);
      body.append('paperType', paperForm.paperType);
      if (paperForm.chapter) body.append('chapter', paperForm.chapter);
      body.append('totalMarks', paperForm.totalMarks);
      body.append('durationMinutes', paperForm.durationMinutes);
      body.append('status', 'published');

      if (paperPdf) body.append('pdf', paperPdf);

      if (paperModal.existingPaper) {
        // Update existing paper
        await api(`/api/admin/papers/${paperModal.existingPaper.id}`, {
          method: 'PATCH',
          body,
        });
      } else {
        // Create new paper for this schedule
        body.append('groupId', paperModal.groupId);
        body.append('scheduleNumber', paperModal.scheduleNumber);
        if (paperModal.scheduleAvailableAt) {
          body.append('availableAt', paperModal.scheduleAvailableAt);
        }
        await api('/api/admin/papers', { method: 'POST', body });
      }

      setPaperModal(null);
      reload();
    } catch (err) {
      setPaperError(err.message);
    } finally {
      setPaperLoading(false);
    }
  }

  // ── Delete paper ──
  async function deletePaper(paperId) {
    if (!window.confirm('Delete this question paper? This will also remove any attempts.')) return;
    try {
      await api(`/api/admin/papers/${paperId}`, { method: 'DELETE' });
      reload();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <AdminPortalLayout>
      {/* ── Header with Create Group button ── */}
      <div className="panel-head" style={{ marginBottom: '1rem' }}>
        <div>
          <h2>Question Paper Groups</h2>
          <p className="muted" style={{ fontSize: '0.88rem', margin: '0.2rem 0 0' }}>
            Organize question papers by Group and Schedules. Each schedule holds question papers for multiple subjects sharing a common scheduled release time.
          </p>
        </div>
        <button className="btn primary" onClick={() => setShowCreateGroup(!showCreateGroup)}>
          {showCreateGroup ? 'Cancel' : '+ Create Group'}
        </button>
      </div>

      {groupMessage && <p className="success" style={{ marginBottom: '1rem' }}>{groupMessage}</p>}

      {/* ── Create Group Form ── */}
      {showCreateGroup && (
        <div className="panel form" style={{ marginBottom: '1.5rem' }}>
          <h3>Create new question paper group</h3>
          <form onSubmit={createGroup}>
            <label>
              Group Name
              <input
                value={groupForm.name}
                onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                placeholder="e.g. CA Intermediate Test Series"
                required
              />
            </label>
            <label>
              Description (optional)
              <input
                value={groupForm.description}
                onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                placeholder="Brief description of this test series group"
              />
            </label>
            <div className="row-2">
              <label>
                Number of Schedules
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={groupForm.numSchedules}
                  onChange={(e) => setGroupForm({ ...groupForm, numSchedules: e.target.value })}
                  required
                />
                <span className="muted" style={{ fontSize: '0.8rem' }}>
                  e.g. 5 schedules (Schedule 1, 2, 3, 4, 5)
                </span>
              </label>
              <label>
                Subjects per Schedule
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={groupForm.numSubjectsPerSchedule}
                  onChange={(e) => setGroupForm({ ...groupForm, numSubjectsPerSchedule: e.target.value })}
                  required
                />
                <span className="muted" style={{ fontSize: '0.8rem' }}>
                  e.g. 3 subjects (3 papers uploaded per schedule)
                </span>
              </label>
            </div>
            {groupError && <p className="error">{groupError}</p>}
            <button className="btn primary" style={{ marginTop: '0.5rem' }}>Create Group</button>
          </form>
        </div>
      )}

      {/* ── Groups List ── */}
      {loading ? (
        <p className="muted">Loading groups…</p>
      ) : groups.length === 0 ? (
        <div className="panel" style={{ textAlign: 'center', padding: '3rem' }}>
          <p className="muted">No question paper groups yet. Create a group to start organizing question papers.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {groups.map((g) => {
            const expectedSubjects = g.numSubjectsPerSchedule || 3;
            const totalExpected = g.totalExpectedPapers || (g.numSchedules * expectedSubjects);
            const totalUploaded = g.totalUploadedPapers || 0;
            const progress = totalExpected > 0 ? Math.round((totalUploaded / totalExpected) * 100) : 0;

            return (
              <div
                key={g.id}
                className="panel group-panel"
                onClick={() => setSelectedGroup(g)}
                style={{
                  padding: '1.1rem 1.4rem',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'box-shadow 0.18s, transform 0.18s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 20px rgba(99,102,241,0.13)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.transform = ''; }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {g.name}
                  </h3>
                  {g.description && <p className="muted" style={{ margin: '0.2rem 0 0.5rem', fontSize: '0.83rem' }}>{g.description}</p>}
                  {/* Progress bar */}
                  <div style={{ marginTop: '0.45rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{ flex: 1, height: '5px', borderRadius: '99px', background: '#e5e7eb', overflow: 'hidden' }}>
                      <div style={{ width: `${progress}%`, height: '100%', borderRadius: '99px', background: progress === 100 ? '#22c55e' : '#000000ff', transition: 'width 0.4s' }} />
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#6b7280', whiteSpace: 'nowrap' }}>{totalUploaded}/{totalExpected} papers</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
                  <span className="pill info" style={{ fontSize: '0.78rem' }}>
                    {g.numSchedules} Schedules
                  </span>
                  <button
                    type="button"
                    className="btn subtle"
                    onClick={(e) => { e.stopPropagation(); setEditingGroup({ ...g }); }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn subtle danger"
                    onClick={(e) => { e.stopPropagation(); deleteGroup(g.id); }}
                  >
                    Delete
                  </button>
                  <span style={{ fontSize: '1rem', color: '#9ca3af' }}>›</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Group Schedules Popup Modal ── */}
      {selectedGroup && (() => {
        const g = groups.find((x) => x.id === selectedGroup.id) || selectedGroup;
        const expectedSubjects = g.numSubjectsPerSchedule || 3;
        return (
          <div
            className="modal-backdrop"
            onClick={() => setSelectedGroup(null)}
            style={{ alignItems: 'flex-start', paddingTop: '3vh' }}
          >
            <div
              className="modal-card"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: '860px', width: '96%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
            >
              {/* Modal Header */}
              <div className="modal-head" style={{ flexShrink: 0 }}>
                <div>
                  <h2 style={{ margin: 0 }}> {g.name}</h2>
                  {g.description && <p className="muted" style={{ margin: '0.2rem 0 0', fontSize: '0.85rem' }}>{g.description}</p>}
                </div>
                <button
                  type="button"
                  className="btn subtle"
                  onClick={() => setSelectedGroup(null)}
                  style={{ padding: '0.35rem 0.75rem', borderRadius: '50%', flexShrink: 0 }}
                >
                  ✕
                </button>
              </div>

              {/* Scrollable schedules list */}
              <div style={{ overflowY: 'auto', flex: 1, padding: '1rem 1.5rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {(g.schedules || []).map((sched) => {
                  const papers = sched.papers || [];
                  const canAddMore = papers.length < expectedSubjects;
                  const isUploaded = papers.length > 0;
                  return (
                    <div
                      key={sched.scheduleNumber}
                      style={{
                        border: isUploaded ? '1.5px dashed var(--border, #d1d5db)' : '1px solid #000000ff',
                        borderLeft: isUploaded ? '4px solid #9ca3af' : '4px solid #000000ff',
                        borderRadius: '10px',
                        background: isUploaded ? '#f5f5f7' : '#fafafa',
                        overflow: 'hidden',
                        opacity: isUploaded ? 0.55 : 1,
                        transition: 'opacity 0.2s, border-color 0.2s',
                      }}
                    >
                      {/* Schedule Bar */}
                      <div
                        style={{
                          padding: '0.85rem 1.25rem',
                          background: '#f3f4f6',
                          borderBottom: '1px solid var(--border, #e5e7eb)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '0.75rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <strong style={{ fontSize: '1rem' }}>Schedule {sched.scheduleNumber}</strong>
                          <span className={`pill ${papers.length >= expectedSubjects ? 'published' : papers.length > 0 ? 'assigned' : 'draft'}`} style={{ fontSize: '0.78rem' }}>
                            {papers.length} / {expectedSubjects} Subjects Uploaded
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                            <span className="muted">Scheduled Access:</span>
                            <strong>{formatScheduleDate(sched.availableAt)}</strong>
                            <button
                              type="button"
                              className="btn subtle"
                              style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                              onClick={() => openScheduleDateModal(g.id, g.name, sched.scheduleNumber, sched.availableAt)}
                            >
                              {sched.availableAt ? 'Change Date/Time' : 'Set Date/Time'}
                            </button>
                          </div>

                          {canAddMore && (
                            <button
                              type="button"
                              className="btn primary"
                              style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                              onClick={() => openPaperModal(g.id, g.name, sched.scheduleNumber, null, sched.availableAt, papers)}
                            >
                              + Upload Subject Paper ({papers.length + 1}/{expectedSubjects})
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Subject Papers in this Schedule */}
                      <div style={{ padding: '0.75rem 1.25rem' }}>
                        {papers.length === 0 ? (
                          <div style={{ padding: '1rem', textAlign: 'center', color: '#6b7280', fontSize: '0.9rem' }}>
                            No subject question papers uploaded yet. Click <strong>&quot;+ Upload Subject Paper&quot;</strong> to upload papers for up to {expectedSubjects} subjects.
                          </div>
                        ) : (
                          <table className="data-table" style={{ background: '#fff', borderRadius: '6px' }}>
                            <thead>
                              <tr>
                                <th style={{ width: '14rem' }}>Subject</th>
                                <th>Paper Title</th>
                                <th>Subject Type</th>
                                <th>Marks &amp; Duration</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {papers.map((p) => (
                                <tr key={p.id}>
                                  <td>
                                    <strong style={{ fontSize: '0.92rem' }}>{p.subjectName}</strong>
                                    <div className="muted" style={{ fontSize: '0.78rem' }}>{p.caLevel}</div>
                                  </td>
                                  <td>
                                    <span style={{ fontWeight: 500 }}>{p.title}</span>
                                    {p.chapter && <div className="muted" style={{ fontSize: '0.78rem' }}>{p.chapter}</div>}
                                  </td>
                                  <td>
                                    <span className="pill info" style={{ fontSize: '0.75rem' }}>{p.paperType}</span>
                                  </td>
                                  <td>
                                    <span style={{ fontSize: '0.85rem' }}>{p.totalMarks} marks · {p.durationMinutes} min</span>
                                  </td>
                                  <td style={{ textAlign: 'right' }}>
                                    <div className="table-actions" style={{ justifyContent: 'flex-end' }}>
                                      <button
                                        type="button"
                                        className="btn subtle"
                                        onClick={() => openPaperModal(g.id, g.name, sched.scheduleNumber, p, sched.availableAt, papers)}
                                      >
                                        Edit
                                      </button>
                                      {p.pdfUrl && (
                                        <a href={p.pdfUrl} target="_blank" rel="noreferrer" className="btn subtle">
                                          PDF
                                        </a>
                                      )}
                                      <button
                                        type="button"
                                        className="btn subtle danger"
                                        onClick={() => deletePaper(p.id)}
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Schedule Date/Time Modal ── */}
      {scheduleDateModal && (
        <div className="modal-backdrop" onClick={() => setScheduleDateModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-head">
              <h2>Schedule {scheduleDateModal.scheduleNumber} &ndash; Access Date &amp; Time</h2>
              <button
                type="button"
                className="btn subtle"
                onClick={() => setScheduleDateModal(null)}
                style={{ padding: '0.35rem 0.75rem', borderRadius: '50%' }}
              >
                ✕
              </button>
            </div>
            <p className="muted" style={{ fontSize: '0.88rem', margin: '0 0 1rem' }}>
              Set the scheduled date and time when all subject question papers under <strong>Schedule {scheduleDateModal.scheduleNumber}</strong> become accessible to students.
            </p>
            <form className="form" onSubmit={saveScheduleDate}>
              <div className="row-2">
                <label>
                  Available/Open Date
                  <input
                    type="date"
                    value={scheduleDateForm.availableDate}
                    onChange={(e) => setScheduleDateForm({ ...scheduleDateForm, availableDate: e.target.value })}
                  />
                </label>
                <label>
                  Available/Open Time
                  <input
                    type="time"
                    value={scheduleDateForm.availableTime}
                    onChange={(e) => setScheduleDateForm({ ...scheduleDateForm, availableTime: e.target.value })}
                  />
                </label>
              </div>
              <span className="muted" style={{ fontSize: '0.8rem', display: 'block', marginTop: '-0.25rem', marginBottom: '1rem' }}>
                Clear fields for immediate access without restrictions.
              </span>
              {scheduleDateError && <p className="error">{scheduleDateError}</p>}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    setScheduleDateForm({ availableDate: '', availableTime: '' });
                  }}
                >
                  Clear (Immediate)
                </button>
                <button type="submit" className="btn primary" disabled={scheduleDateLoading}>
                  {scheduleDateLoading ? 'Saving…' : 'Save Date & Time'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Group Modal ── */}
      {editingGroup && (
        <div className="modal-backdrop" onClick={() => setEditingGroup(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>Edit Group</h2>
              <button type="button" className="btn subtle" onClick={() => setEditingGroup(null)} style={{ padding: '0.35rem 0.75rem', borderRadius: '50%' }}>✕</button>
            </div>
            <form className="form" onSubmit={saveEditGroup}>
              <label>
                Group Name
                <input
                  value={editingGroup.name}
                  onChange={(e) => setEditingGroup({ ...editingGroup, name: e.target.value })}
                  required
                />
              </label>
              <label>
                Description
                <input
                  value={editingGroup.description}
                  onChange={(e) => setEditingGroup({ ...editingGroup, description: e.target.value })}
                />
              </label>
              <div className="row-2">
                <label>
                  Number of Schedules
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={editingGroup.numSchedules}
                    onChange={(e) => setEditingGroup({ ...editingGroup, numSchedules: e.target.value })}
                    required
                  />
                </label>
                <label>
                  Subjects per Schedule
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={editingGroup.numSubjectsPerSchedule || 3}
                    onChange={(e) => setEditingGroup({ ...editingGroup, numSubjectsPerSchedule: e.target.value })}
                    required
                  />
                </label>
              </div>
              {editGroupError && <p className="error">{editGroupError}</p>}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button type="button" className="btn ghost" onClick={() => setEditingGroup(null)}>Cancel</button>
                <button type="submit" className="btn primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Paper Upload/Edit Modal ── */}
      {paperModal && (
        <div className="modal-backdrop" onClick={() => setPaperModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px' }}>
            <div className="modal-head">
              <h2>
                {paperModal.existingPaper ? 'Edit' : 'Upload'} &ndash; Schedule {paperModal.scheduleNumber} Paper
              </h2>
              <button type="button" className="btn subtle" onClick={() => setPaperModal(null)} style={{ padding: '0.35rem 0.75rem', borderRadius: '50%' }}>✕</button>
            </div>
            <form className="form" onSubmit={savePaper}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
                <span className="pill info" style={{ fontSize: '0.85rem' }}>
                  Schedule {paperModal.scheduleNumber}
                </span>
                <span className="muted" style={{ fontSize: '0.85rem' }}>
                  {paperModal.scheduleAvailableAt
                    ? `Scheduled Access: ${formatScheduleDate(paperModal.scheduleAvailableAt)}`
                    : 'Scheduled Access: Immediate'}
                </span>
              </div>

              <label>
                Subject
                <select
                  value={paperForm.subjectId}
                  onChange={(e) => {
                    const selSub = subjects.find((s) => s.id === e.target.value);
                    setPaperForm({
                      ...paperForm,
                      subjectId: e.target.value,
                      title: paperModal.existingPaper ? paperForm.title : (selSub ? `Schedule ${paperModal.scheduleNumber} - ${selSub.name}` : paperForm.title),
                    });
                  }}
                  required
                >
                  {subjects.map((s) => {
                    const isAlreadyUsed = !paperModal.existingPaper &&
                      (paperModal.existingPapers || []).some((p) => p.subjectId === s.id);
                    return (
                      <option key={s.id} value={s.id} disabled={isAlreadyUsed}>
                        {s.name} {isAlreadyUsed ? '(already uploaded for this schedule)' : ''}
                      </option>
                    );
                  })}
                </select>
              </label>

              <label>
                Paper Title
                <input
                  value={paperForm.title}
                  onChange={(e) => setPaperForm({ ...paperForm, title: e.target.value })}
                  placeholder="e.g. Schedule 1 - Advanced Accounting"
                  required
                />
              </label>

              <div className="row-2">
                <label>
                  CA Level
                  <select
                    value={paperForm.caLevel}
                    onChange={(e) => setPaperForm({ ...paperForm, caLevel: e.target.value })}
                  >
                    <option>Intermediate</option>
                    <option>Final</option>
                  </select>
                </label>
                <label>
                  Subject Type
                  <select
                    value={paperForm.paperType}
                    onChange={(e) => setPaperForm({ ...paperForm, paperType: e.target.value })}
                  >
                    <option value="Group 1">Group 1</option>
                    <option value="Group 2">Group 2</option>
                    <option value="Chapter Test">Chapter Test</option>
                    <option value="Mock Test">Mock Test</option>
                    <option value="Revision Test">Revision Test</option>
                    <option value="Model Exam">Model Exam</option>
                  </select>
                </label>
              </div>

              <label>
                Chapter / Topics (optional)
                <input
                  value={paperForm.chapter}
                  onChange={(e) => setPaperForm({ ...paperForm, chapter: e.target.value })}
                  placeholder="e.g. Chapter 1-3 or Full Syllabus"
                />
              </label>

              <div className="row-2">
                <label>
                  Total Marks
                  <input
                    type="number"
                    value={paperForm.totalMarks}
                    onChange={(e) => setPaperForm({ ...paperForm, totalMarks: e.target.value })}
                  />
                </label>
                <label>
                  Duration (min)
                  <input
                    type="number"
                    value={paperForm.durationMinutes}
                    onChange={(e) => setPaperForm({ ...paperForm, durationMinutes: e.target.value })}
                  />
                </label>
              </div>

              {paperModal.existingPaper?.pdfUrl && (
                <label>
                  Current PDF
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
                    <a href={paperModal.existingPaper.pdfUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>
                      View current uploaded file
                    </a>
                  </div>
                </label>
              )}

              <label>
                {paperModal.existingPaper ? 'Replace / Upload new PDF' : 'Question Paper PDF'}
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setPaperPdf(e.target.files?.[0] || null)}
                />
              </label>

              {paperError && <p className="error">{paperError}</p>}

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button type="button" className="btn ghost" onClick={() => setPaperModal(null)}>Cancel</button>
                <button type="submit" className="btn primary" disabled={paperLoading}>
                  {paperLoading ? 'Saving…' : paperModal.existingPaper ? 'Save Changes' : 'Upload & Publish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminPortalLayout>
  );
}

export function AdminSubmissions() {
  const [allSubmissions, setAllSubmissions] = useState([]);
  const [reviewers, setReviewers] = useState([]);
  const [selected, setSelected] = useState([]);
  const [reviewerId, setReviewerId] = useState('');
  const [message, setMessage] = useState('');
  const [loaded, setLoaded] = useState(false);

  function reload() {
    api('/api/admin/submissions').then((d) => {
      setAllSubmissions(d.submissions || []);
      setLoaded(true);
    });
  }

  useEffect(() => {
    reload();
    api('/api/admin/users?role=reviewer').then((d) => {
      setReviewers(d.users);
      setReviewerId(d.users[0]?.id || '');
    });
  }, []);

  function toggle(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function assign() {
    setMessage('');
    const data = await api('/api/admin/assign', {
      method: 'POST',
      body: { submissionIds: selected, reviewerId },
    });
    setMessage(`Assigned ${data.assignedCount} submission(s).`);
    setSelected([]);
    reload();
  }

  // Only show submissions that need to be assigned (not yet assigned to a reviewer)
  const submissions = allSubmissions.filter(
    (s) => s.status === 'submitted' && !s.assignedReviewerId
  );

  const unassignedCount = loaded ? submissions.length : undefined;

  return (
    <AdminPortalLayout unassignedCount={unassignedCount}>
      <div className="panel">
        <div className="panel-head">
          <h2>Unassigned submissions</h2>
          <div className="assign-bar">
            <select value={reviewerId} onChange={(e) => setReviewerId(e.target.value)}>
              {reviewers.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <button className="btn primary" disabled={!selected.length || !reviewerId} onClick={assign}>
              Assign selected ({selected.length})
            </button>
          </div>
        </div>
        {message && <p className="success">{message}</p>}
        <table className="data-table">
          <thead>
            <tr>
              <th></th>
              <th>Student</th>
              <th>Paper</th>
              <th>Submitted</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((s) => (
              <tr key={s.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selected.includes(s.id)}
                    onChange={() => toggle(s.id)}
                  />
                </td>
                <td>{s.studentName}</td>
                <td>{s.paperTitle}</td>
                <td>{new Date(s.submittedAt).toLocaleString()}</td>
              </tr>
            ))}
            {submissions.length === 0 && loaded && (
              <tr>
                <td colSpan={4} className="muted" style={{ textAlign: 'center', padding: '2rem' }}>
                  No unassigned submissions. All submissions have been assigned to reviewers.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminPortalLayout>
  );
}

export function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [activeRole, setActiveRole] = useState('student');
  const [loading, setLoading] = useState(true);

  // Add User modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', email: '', phone: '', role: 'student' });
  const [addError, setAddError] = useState('');
  const [addBusy, setAddBusy] = useState(false);
  const [generatedPwd, setGeneratedPwd] = useState('');

  // Edit User modal
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', phone: '', role: '' });
  const [editError, setEditError] = useState('');
  const [editBusy, setEditBusy] = useState(false);

  // Global status/error
  const [toast, setToast] = useState(null); // { ok: bool, text: string }

  function showToast(ok, text) {
    setToast({ ok, text });
    setTimeout(() => setToast(null), 4000);
  }

  function reload() {
    setLoading(true);
    api('/api/admin/users')
      .then((d) => { setUsers(d.users || []); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(() => { reload(); }, []);

  const roleTabs = [
    { key: 'student', label: 'Students' },
    { key: 'reviewer', label: 'Reviewers' },
    { key: 'admin', label: 'Admins' },
  ];

  const filtered = users.filter((u) => u.role === activeRole);

  // ── Add User ──
  async function createUser(e) {
    e.preventDefault();
    setAddError('');
    setAddBusy(true);
    setGeneratedPwd('');
    try {
      const res = await api('/api/admin/users', {
        method: 'POST',
        body: {
          name: addForm.name,
          email: addForm.email,
          phone: addForm.phone,
          role: addForm.role,
        },
      });
      if (res.generatedPassword) setGeneratedPwd(res.generatedPassword);
      reload();
      setAddForm({ name: '', email: '', phone: '', role: 'student' });
      if (!res.generatedPassword) {
        setShowAddModal(false);
        showToast(true, 'User created successfully.');
      }
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAddBusy(false);
    }
  }

  // ── Edit User ──
  function openEdit(u) {
    setEditUser(u);
    setEditForm({ name: u.name, phone: u.phone || '', role: u.role });
    setEditError('');
  }

  async function saveEdit(e) {
    e.preventDefault();
    setEditError('');
    setEditBusy(true);
    try {
      await api(`/api/admin/users/${editUser.id}`, {
        method: 'PATCH',
        body: { name: editForm.name, phone: editForm.phone, role: editForm.role },
      });
      setEditUser(null);
      reload();
      showToast(true, 'User updated.');
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditBusy(false);
    }
  }

  // ── Delete User ──
  async function deleteUser(u) {
    if (!window.confirm(`Delete ${u.name}? This cannot be undone.`)) return;
    try {
      await api(`/api/admin/users/${u.id}`, { method: 'DELETE' });
      reload();
      showToast(true, `"${u.name}" deleted.`);
    } catch (err) {
      showToast(false, err.message);
    }
  }

  return (
    <AdminPortalLayout>
      {/* ── Top bar ── */}
      <div className="panel-head" style={{ marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>Users</h2>
          <p className="muted" style={{ margin: '0.2rem 0 0', fontSize: '0.88rem' }}>
            Manage all users. Select a role tab to filter.
          </p>
        </div>
        <button className="btn primary" onClick={() => { setShowAddModal(true); setAddError(''); setGeneratedPwd(''); }}>
          + Add User
        </button>
      </div>

      {/* ── Role Tabs ── */}
      <div className="users-role-tabs">
        {roleTabs.map((t) => {
          const count = users.filter((u) => u.role === t.key).length;
          return (
            <button
              key={t.key}
              className={`users-role-tab${activeRole === t.key ? ' active' : ''}`}
              onClick={() => setActiveRole(t.key)}
            >
              {t.label}
              <span className="users-role-count">{count}</span>
            </button>
          );
        })}
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div className={`users-toast ${toast.ok ? 'ok' : 'err'}`}>
          {toast.ok ? '✓' : '✕'} {toast.text}
        </div>
      )}

      {/* ── Users Table ── */}
      <div className="panel" style={{ marginTop: '1rem' }}>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="muted" style={{ textAlign: 'center', padding: '2.5rem' }}>
            No {activeRole}s found.
          </p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.name}</strong>
                  </td>
                  <td className="muted" style={{ fontSize: '0.88rem' }}>{u.email}</td>
                  <td className="muted" style={{ fontSize: '0.88rem' }}>{u.phone || '—'}</td>
                  <td>
                    <div className="table-actions" style={{ justifyContent: 'center', gap: '0.35rem' }}>
                      <button
                        type="button"
                        className="icon-action-btn edit"
                        title="Edit user"
                        onClick={() => openEdit(u)}
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        className="icon-action-btn delete"
                        title="Delete user"
                        onClick={() => deleteUser(u)}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Add User Modal ── */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => { if (!addBusy) { setShowAddModal(false); setGeneratedPwd(''); } }}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-head">
              <h2>Add New User</h2>
              <button
                type="button"
                className="btn subtle"
                style={{ borderRadius: '50%', padding: '0.35rem 0.65rem' }}
                onClick={() => { setShowAddModal(false); setGeneratedPwd(''); }}
              >
                ✕
              </button>
            </div>

            {generatedPwd ? (
              /* ── Success: show generated password ── */
              <div>
                <div className="success-box" style={{ marginBottom: '1rem' }}>
                  <p style={{ margin: '0 0 0.5rem', fontWeight: 700 }}>✓ User created successfully!</p>
                  <p style={{ margin: 0, fontSize: '0.9rem' }}>
                    Share this auto-generated password with the user:
                  </p>
                </div>
                <div className="gen-pwd-box">
                  <code className="gen-pwd-text">{generatedPwd}</code>
                  <button
                    type="button"
                    className="btn subtle"
                    style={{ fontSize: '0.8rem', padding: '0.3rem 0.65rem' }}
                    onClick={() => navigator.clipboard.writeText(generatedPwd)}
                  >
                    Copy
                  </button>
                </div>
                <p className="muted" style={{ fontSize: '0.82rem', marginTop: '0.5rem' }}>
                  The user can change this password after logging in.
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
                  <button className="btn ghost" onClick={() => { setGeneratedPwd(''); }}>
                    Add Another
                  </button>
                  <button className="btn primary" onClick={() => { setShowAddModal(false); setGeneratedPwd(''); }}>
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form className="form" onSubmit={createUser}>
                <label>
                  Full Name
                  <input
                    value={addForm.name}
                    onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                    placeholder="e.g. Arjun Menon"
                    required
                  />
                </label>
                <label>
                  Email Address
                  <input
                    type="email"
                    value={addForm.email}
                    onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                    placeholder="e.g. arjun@example.com"
                    required
                    autoComplete="off"
                  />
                </label>
                <label>
                  Phone Number
                  <input
                    type="tel"
                    value={addForm.phone}
                    onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                    placeholder="e.g. +91 9876543210"
                  />
                </label>
                <label>
                  Role
                  <select value={addForm.role} onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}>
                    <option value="student">Student</option>
                    <option value="reviewer">Reviewer</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
                <p className="muted" style={{ fontSize: '0.82rem', margin: '-0.25rem 0 0' }}>
                  A password will be auto-generated from the user's name and shown after creation.
                </p>
                {addError && <p className="error">{addError}</p>}
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn ghost" onClick={() => setShowAddModal(false)}>Cancel</button>
                  <button type="submit" className="btn primary" disabled={addBusy}>
                    {addBusy ? 'Creating…' : 'Create User'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Edit User Modal ── */}
      {editUser && (
        <div className="modal-backdrop" onClick={() => { if (!editBusy) setEditUser(null); }}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-head">
              <h2>Edit User</h2>
              <button
                type="button"
                className="btn subtle"
                style={{ borderRadius: '50%', padding: '0.35rem 0.65rem' }}
                onClick={() => setEditUser(null)}
              >
                ✕
              </button>
            </div>
            <p className="muted" style={{ margin: '0 0 1rem', fontSize: '0.88rem' }}>
              {editUser.email}
            </p>
            <form className="form" onSubmit={saveEdit}>
              <label>
                Full Name
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  required
                />
              </label>
              <label>
                Phone Number
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  placeholder="e.g. +91 9876543210"
                />
              </label>
              <label>
                Role
                <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
                  <option value="student">Student</option>
                  <option value="reviewer">Reviewer</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              {editError && <p className="error">{editError}</p>}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn ghost" onClick={() => setEditUser(null)}>Cancel</button>
                <button type="submit" className="btn primary" disabled={editBusy}>
                  {editBusy ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminPortalLayout>
  );
}


// ─── Admin Insights ────────────────────────────────────────────────────────────
export function AdminInsights() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [groupSearch, setGroupSearch] = useState('');

  useEffect(() => {
    api('/api/admin/insights')
      .then((d) => {
        setGroups(d.groups || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Drill-down 2a: Student scorecard for a group
  if (selectedStudent && selectedGroup) {
    return (
      <InsightStudentScorecard
        group={selectedGroup}
        student={selectedStudent}
        onBack={() => setSelectedStudent(null)}
      />
    );
  }

  // Drill-down 2b: Single paper results
  if (selectedPaper) {
    const results = selectedPaper.studentResults || [];
    const evaluated = results.filter((r) => r.marksAwarded != null);
    const avgMark = evaluated.length
      ? Math.round((evaluated.reduce((s, r) => s + r.marksAwarded, 0) / evaluated.length) * 10) / 10
      : null;
    const highest = evaluated.length ? Math.max(...evaluated.map((r) => r.marksAwarded)) : null;
    const lowest = evaluated.length ? Math.min(...evaluated.map((r) => r.marksAwarded)) : null;

    return (
      <AdminPortalLayout>
        <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <button className="btn ghost" onClick={() => setSelectedPaper(null)}>
            ← Back to {selectedGroup?.name}
          </button>
          {selectedPaper.pdfUrl && (
            <a href={selectedPaper.pdfUrl} target="_blank" rel="noreferrer" className="btn ghost">
              View Question Paper PDF ↗
            </a>
          )}
        </div>

        <div className="panel" style={{ marginBottom: '1.25rem' }}>
          <div className="panel-head" style={{ marginBottom: '0.75rem' }}>
            <div>
              <h2 style={{ margin: 0 }}>{selectedPaper.title}</h2>
              <p className="muted" style={{ margin: '0.2rem 0 0', fontSize: '0.88rem' }}>
                {selectedPaper.subjectName} · {selectedPaper.caLevel} · {selectedPaper.paperType} · {selectedPaper.totalMarks} marks
              </p>
            </div>
          </div>

          <div className="stats-grid" style={{ marginBottom: '1.25rem' }}>
            {[
              ['Attempts', results.length],
              ['Evaluated', evaluated.length],
              ['Avg Score', avgMark != null ? `${avgMark} / ${selectedPaper.totalMarks}` : '—'],
              ['Highest', highest != null ? `${highest} / ${selectedPaper.totalMarks}` : '—'],
              ['Lowest', lowest != null ? `${lowest} / ${selectedPaper.totalMarks}` : '—'],
            ].map(([label, val]) => (
              <div className="stat-tile" key={label}>
                <strong style={{ fontSize: '1.35rem' }}>{val}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>

          {results.length === 0 ? (
            <p className="muted" style={{ textAlign: 'center', padding: '2rem' }}>No students have attempted this paper yet.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Email</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th>Score</th>
                  <th>Evaluated</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {results
                  .sort((a, b) => {
                    if (b.marksAwarded != null && a.marksAwarded != null) return b.marksAwarded - a.marksAwarded;
                    if (b.marksAwarded != null) return 1;
                    if (a.marksAwarded != null) return -1;
                    return 0;
                  })
                  .map((r) => {
                    const pct = r.marksAwarded != null && r.totalMarks
                      ? Math.round((r.marksAwarded / r.totalMarks) * 100)
                      : null;
                    return (
                      <tr key={r.submissionId}>
                        <td>
                          <button
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              cursor: 'pointer',
                              fontWeight: 700,
                              color: 'var(--accent, #6366f1)',
                              textDecoration: 'underline',
                              fontSize: '0.92rem',
                            }}
                            title="View student's full group scorecard"
                            onClick={() => setSelectedStudent({ id: r.studentId, name: r.studentName, email: r.studentEmail })}
                          >
                            {r.studentName}
                          </button>
                        </td>
                        <td className="muted" style={{ fontSize: '0.85rem' }}>{r.studentEmail}</td>
                        <td style={{ fontSize: '0.85rem' }}>
                          {r.submittedAt ? new Date(r.submittedAt).toLocaleString() : '—'}
                        </td>
                        <td>
                          <span className={`pill ${r.status}`}>{r.status.replace('_', ' ')}</span>
                        </td>
                        <td>
                          {r.marksAwarded != null ? (
                            <span style={{ fontWeight: 700, color: pct >= 60 ? 'var(--ok)' : pct >= 40 ? 'var(--warn)' : 'var(--danger)' }}>
                              {r.marksAwarded} / {r.totalMarks}
                              <span className="muted" style={{ fontWeight: 400, fontSize: '0.8rem', marginLeft: '0.35rem' }}>({pct}%)</span>
                            </span>
                          ) : (
                            <span className="muted">Pending review</span>
                          )}
                        </td>
                        <td style={{ fontSize: '0.82rem' }} className="muted">
                          {r.evaluatedAt ? new Date(r.evaluatedAt).toLocaleDateString() : '—'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                            {r.answerFileUrl && (
                              <a
                                href={r.answerFileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="btn ghost"
                                style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                                title="View uploaded answer file"
                              >
                                Answer Sheet ↗
                              </a>
                            )}
                            <button
                              className="btn subtle"
                              style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                              onClick={() => setSelectedStudent({ id: r.studentId, name: r.studentName, email: r.studentEmail })}
                            >
                              Scorecard →
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}
        </div>
      </AdminPortalLayout>
    );
  }

  // Drill-down 1: Single group detail
  if (selectedGroup) {
    return (
      <InsightGroupDetail
        group={selectedGroup}
        onBack={() => {
          setSelectedGroup(null);
          setSelectedPaper(null);
          setSelectedStudent(null);
        }}
        onSelectPaper={(paper) => setSelectedPaper(paper)}
        onSelectStudent={(student) => setSelectedStudent(student)}
      />
    );
  }

  // Filter groups
  const filteredGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(groupSearch.toLowerCase()) ||
    (g.description && g.description.toLowerCase().includes(groupSearch.toLowerCase()))
  );

  // Top-level: all groups
  return (
    <AdminPortalLayout>
      <div className="panel-head" style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>Insights</h2>
          <p className="muted" style={{ margin: '0.2rem 0 0', fontSize: '0.88rem' }}>
            Click a group to see students who attempted it and their scheduled paper marks.
          </p>
        </div>
        {groups.length > 3 && (
          <input
            type="search"
            placeholder="Search groups…"
            value={groupSearch}
            onChange={(e) => setGroupSearch(e.target.value)}
            style={{
              padding: '0.45rem 0.85rem',
              borderRadius: '8px',
              border: '1px solid var(--line)',
              fontSize: '0.88rem',
              background: 'var(--panel)',
              color: 'var(--ink)',
              minWidth: '220px',
            }}
          />
        )}
      </div>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : groups.length === 0 ? (
        <div className="panel" style={{ textAlign: 'center', padding: '3rem' }}>
          <p className="muted">No question paper groups found. Create a group first from Question Papers.</p>
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="panel" style={{ textAlign: 'center', padding: '2rem' }}>
          <p className="muted">No groups matching &ldquo;{groupSearch}&rdquo;.</p>
        </div>
      ) : (
        <div className="insights-groups-grid">
          {filteredGroups.map((g) => {
            const allPapers = g.schedules.flatMap((s) => s.papers);
            const totalAttempts = allPapers.reduce((sum, p) => sum + (p.attemptCount || 0), 0);
            const totalEvaluated = allPapers.reduce((sum, p) => sum + (p.evaluatedCount || 0), 0);
            const uniqueStudents = new Set(
              allPapers.flatMap((p) => (p.studentResults || []).map((r) => r.studentId))
            ).size;
            return (
              <button
                key={g.id}
                className="insights-group-card"
                onClick={() => setSelectedGroup(g)}
              >
                <h3 className="insights-group-name">{g.name}</h3>
                {g.description && <p className="insights-group-desc">{g.description}</p>}
                <div className="insights-group-stats">
                  <div>
                    <span className="insights-stat-num">{g.totalPapers}</span>
                    <span className="insights-stat-label">Papers</span>
                  </div>
                  <div>
                    <span className="insights-stat-num">{uniqueStudents}</span>
                    <span className="insights-stat-label">Students</span>
                  </div>
                  <div>
                    <span className="insights-stat-num">{totalAttempts}</span>
                    <span className="insights-stat-label">Attempts</span>
                  </div>
                  <div>
                    <span className="insights-stat-num">{totalEvaluated}</span>
                    <span className="insights-stat-label">Evaluated</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </AdminPortalLayout>
  );
}

// ─── InsightGroupDetail: Students tab + Papers tab ────────────────────────────
function InsightGroupDetail({ group, onBack, onSelectPaper, onSelectStudent }) {
  const [activeTab, setActiveTab] = useState('students');
  const [studentSearch, setStudentSearch] = useState('');
  const [sortBy, setSortBy] = useState('marks'); // 'marks', 'attempts', 'name'

  const allPapers = group.schedules.flatMap((s) => s.papers);
  const totalAttempts = allPapers.reduce((sum, p) => sum + (p.attemptCount || 0), 0);
  const totalEvaluated = allPapers.reduce((sum, p) => sum + (p.evaluatedCount || 0), 0);

  // Build unique student list across all papers in this group
  const studentMap = new Map();
  for (const paper of allPapers) {
    for (const r of paper.studentResults || []) {
      if (!studentMap.has(r.studentId)) {
        studentMap.set(r.studentId, {
          id: r.studentId,
          name: r.studentName,
          email: r.studentEmail,
          attempts: 0,
          evaluated: 0,
          totalMarksAwarded: 0,
          totalMaxMarks: 0,
        });
      }
      const entry = studentMap.get(r.studentId);
      entry.attempts += 1;
      if (r.marksAwarded != null) {
        entry.evaluated += 1;
        entry.totalMarksAwarded += r.marksAwarded;
        entry.totalMaxMarks += r.totalMarks || 0;
      }
    }
  }
  const students = [...studentMap.values()];

  // Search & sort students
  const filteredStudents = students.filter((s) =>
    s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.email.toLowerCase().includes(studentSearch.toLowerCase())
  );

  filteredStudents.sort((a, b) => {
    if (sortBy === 'marks') return b.totalMarksAwarded - a.totalMarksAwarded;
    if (sortBy === 'attempts') return b.attempts - a.attempts;
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    return 0;
  });

  return (
    <AdminPortalLayout>
      <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button className="btn ghost" onClick={onBack}>← All Groups</button>
        <h2 style={{ margin: 0 }}>{group.name}</h2>
        {group.description && <span className="muted" style={{ fontSize: '0.9rem' }}>{group.description}</span>}
      </div>

      <div className="stats-grid" style={{ marginBottom: '1.25rem' }}>
        {[
          ['Question Papers', group.totalPapers],
          ['Students Attempted', students.length],
          ['Total Attempts', totalAttempts],
          ['Evaluated Papers', totalEvaluated],
        ].map(([label, val]) => (
          <div className="stat-tile" key={label}>
            <strong style={{ fontSize: '1.5rem' }}>{val}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="users-role-tabs" style={{ marginBottom: '1.25rem' }}>
        <button
          className={`users-role-tab${activeTab === 'students' ? ' active' : ''}`}
          onClick={() => setActiveTab('students')}
        >
          Students
          <span className="users-role-count">{students.length}</span>
        </button>
        <button
          className={`users-role-tab${activeTab === 'papers' ? ' active' : ''}`}
          onClick={() => setActiveTab('papers')}
        >
          Papers
          <span className="users-role-count">{allPapers.length}</span>
        </button>
      </div>

      {/* ── Students Tab ── */}
      {activeTab === 'students' && (
        students.length === 0 ? (
          <div className="panel" style={{ textAlign: 'center', padding: '3rem' }}>
            <p className="muted">No students have attempted any paper in this group yet.</p>
          </div>
        ) : (
          <div className="panel">
            {/* Filter controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
              <input
                type="search"
                placeholder="Search students by name or email…"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                style={{
                  padding: '0.45rem 0.85rem',
                  borderRadius: '8px',
                  border: '1px solid var(--line)',
                  fontSize: '0.88rem',
                  background: 'var(--panel)',
                  color: 'var(--ink)',
                  minWidth: '240px',
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                <span className="muted">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  style={{
                    padding: '0.35rem 0.65rem',
                    borderRadius: '6px',
                    border: '1px solid var(--line)',
                    background: 'var(--panel)',
                    color: 'var(--ink)',
                    fontSize: '0.85rem',
                  }}
                >
                  <option value="marks">Highest Marks</option>
                  <option value="attempts">Most Attempts</option>
                  <option value="name">Name (A-Z)</option>
                </select>
              </div>
            </div>

            {filteredStudents.length === 0 ? (
              <p className="muted" style={{ textAlign: 'center', padding: '2rem' }}>
                No students matching &ldquo;{studentSearch}&rdquo;.
              </p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>#</th>
                    <th>Student Name</th>
                    <th>Email</th>
                    <th style={{ textAlign: 'center' }}>Papers Attempted</th>
                    <th style={{ textAlign: 'center' }}>Evaluated</th>
                    <th style={{ textAlign: 'right' }}>Total Marks</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((s, idx) => {
                    const pct = s.totalMaxMarks > 0
                      ? Math.round((s.totalMarksAwarded / s.totalMaxMarks) * 100)
                      : null;
                    return (
                      <tr key={s.id}>
                        <td className="muted" style={{ fontSize: '0.85rem' }}>{idx + 1}</td>
                        <td>
                          <button
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              cursor: 'pointer',
                              fontWeight: 700,
                              color: 'var(--accent, #6366f1)',
                              textDecoration: 'underline',
                              fontSize: '0.95rem',
                              textAlign: 'left',
                            }}
                            title="Click to view full schedule marks scorecard"
                            onClick={() => onSelectStudent(s)}
                          >
                            {s.name}
                          </button>
                        </td>
                        <td className="muted" style={{ fontSize: '0.85rem' }}>{s.email}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span className="pill info" style={{ fontSize: '0.78rem' }}>
                            {s.attempts} / {allPapers.length}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {s.evaluated > 0 ? (
                            <span className="pill published" style={{ fontSize: '0.78rem' }}>{s.evaluated}</span>
                          ) : (
                            <span className="pill draft" style={{ fontSize: '0.78rem' }}>0</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {s.evaluated > 0 ? (
                            <span style={{
                              fontWeight: 700,
                              color: pct >= 60 ? 'var(--ok)' : pct >= 40 ? 'var(--warn)' : 'var(--danger)',
                            }}>
                              {s.totalMarksAwarded} / {s.totalMaxMarks}
                              <span className="muted" style={{ fontWeight: 400, fontSize: '0.78rem', marginLeft: '0.3rem' }}>
                                ({pct}%)
                              </span>
                            </span>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn subtle"
                            style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}
                            onClick={() => onSelectStudent(s)}
                          >
                            View Scorecard →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )
      )}

      {/* ── Papers Tab ── */}
      {activeTab === 'papers' && (
        <>
          {group.schedules.map((sched) => (
            sched.papers.length > 0 && (
              <div key={sched.scheduleNumber} className="panel" style={{ marginBottom: '1.25rem' }}>
                <div className="panel-head">
                  <h3 style={{ margin: 0 }}>Schedule {sched.scheduleNumber}</h3>
                  {sched.availableAt && (
                    <span className="muted" style={{ fontSize: '0.85rem' }}>
                      Available: {new Date(sched.availableAt).toLocaleString()}
                    </span>
                  )}
                </div>
                <div className="insights-paper-grid">
                  {sched.papers.map((paper) => {
                    const evalPapers = (paper.studentResults || []).filter((r) => r.marksAwarded != null);
                    const avg = evalPapers.length
                      ? Math.round((evalPapers.reduce((s, r) => s + r.marksAwarded, 0) / evalPapers.length) * 10) / 10
                      : null;
                    return (
                      <button
                        key={paper.id}
                        className="insights-paper-card"
                        onClick={() => onSelectPaper(paper)}
                      >
                        <div className="insights-paper-subject">{paper.subjectName}</div>
                        <div className="insights-paper-title">{paper.title}</div>
                        <div className="insights-paper-meta">
                          <span className="pill info" style={{ fontSize: '0.73rem' }}>{paper.paperType}</span>
                          <span className="muted" style={{ fontSize: '0.8rem' }}>{paper.totalMarks} marks</span>
                        </div>
                        <div className="insights-paper-stats">
                          <div>
                            <span className="insights-stat-num">{paper.attemptCount}</span>
                            <span className="insights-stat-label">Attempts</span>
                          </div>
                          <div>
                            <span className="insights-stat-num">{paper.evaluatedCount}</span>
                            <span className="insights-stat-label">Evaluated</span>
                          </div>
                          <div>
                            <span className="insights-stat-num">{avg != null ? avg : '—'}</span>
                            <span className="insights-stat-label">Avg Score</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )
          ))}
          {group.schedules.every((s) => s.papers.length === 0) && (
            <div className="panel" style={{ textAlign: 'center', padding: '3rem' }}>
              <p className="muted">No question papers uploaded in this group yet.</p>
            </div>
          )}
        </>
      )}
    </AdminPortalLayout>
  );
}

// ─── InsightStudentScorecard: per-student marks across all scheduled papers ───
function InsightStudentScorecard({ group, student, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    api(`/api/admin/insights/groups/${group.id}/students/${student.id}`)
      .then((d) => { setData(d); setLoading(false); })
      .catch((err) => { setError(err.message || 'Failed to load scorecard.'); setLoading(false); });
  }, [group.id, student.id]);

  const schedules = data?.schedules || [];
  const allPaperResults = schedules.flatMap((s) => s.papers);
  const attempted = allPaperResults.filter((p) => p.status !== 'not_attempted').length;
  const evaluatedCount = allPaperResults.filter((p) => p.marksAwarded != null).length;
  const totalMarksAwarded = allPaperResults.reduce((sum, p) => sum + (p.marksAwarded || 0), 0);
  const totalMaxMarks = allPaperResults
    .filter((p) => p.marksAwarded != null)
    .reduce((sum, p) => sum + (p.totalMarks || 0), 0);
  const overallPct = totalMaxMarks > 0 ? Math.round((totalMarksAwarded / totalMaxMarks) * 100) : null;

  return (
    <AdminPortalLayout>
      {/* Top action bar / breadcrumbs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn ghost" onClick={onBack}>← Back to {group.name}</button>
          <span className="muted" style={{ fontSize: '0.9rem' }}>/ {student.name}</span>
        </div>
        {!loading && (
          <button className="btn ghost" onClick={() => window.print()} style={{ fontSize: '0.85rem' }}>
            🖨️ Print Scorecard
          </button>
        )}
      </div>

      {/* Student Profile & Cumulative Performance */}
      <div className="panel" style={{ marginBottom: '1.25rem', padding: '1.25rem 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.35rem' }}>{student.name}</h2>
            <p className="muted" style={{ margin: '0.2rem 0 0', fontSize: '0.88rem' }}>
              {student.email} {data?.student?.phone ? `· ${data.student.phone}` : ''}
            </p>
          </div>
          {!loading && overallPct != null && (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: '2.4rem',
                fontWeight: 800,
                color: overallPct >= 60 ? 'var(--ok)' : overallPct >= 40 ? 'var(--warn)' : 'var(--danger)',
                lineHeight: 1,
              }}>
                {overallPct}%
              </div>
              <div className="muted" style={{ fontSize: '0.8rem', marginTop: '0.3rem' }}>
                {totalMarksAwarded} / {totalMaxMarks} marks (evaluated papers)
              </div>
            </div>
          )}
        </div>

        {!loading && (
          <div className="stats-grid" style={{ marginTop: '1rem' }}>
            {[
              ['Group Papers', allPaperResults.length],
              ['Attempted', attempted],
              ['Evaluated', evaluatedCount],
              ['Total Score', evaluatedCount > 0 ? `${totalMarksAwarded} / ${totalMaxMarks}` : '—'],
            ].map(([label, val]) => (
              <div className="stat-tile" key={label}>
                <strong style={{ fontSize: '1.2rem' }}>{val}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detailed Schedule Breakdown */}
      {loading ? (
        <p className="muted">Loading scorecard…</p>
      ) : error ? (
        <p className="error">{error}</p>
      ) : (
        schedules.map((sched) => (
          sched.papers.length > 0 && (
            <div key={sched.scheduleNumber} className="panel" style={{ marginBottom: '1.25rem' }}>
              {/* Schedule header */}
              <div className="panel-head" style={{ marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0 }}>Schedule {sched.scheduleNumber}</h3>
                  {(() => {
                    const schAttempted = sched.papers.filter((p) => p.status !== 'not_attempted').length;
                    const schEvaluated = sched.papers.filter((p) => p.marksAwarded != null).length;
                    const schTotal = sched.papers.reduce((sum, p) => sum + (p.marksAwarded || 0), 0);
                    const schMax = sched.papers.filter((p) => p.marksAwarded != null).reduce((sum, p) => sum + (p.totalMarks || 0), 0);
                    return (
                      <>
                        <span className={`pill ${schAttempted === sched.papers.length ? 'published' : schAttempted > 0 ? 'assigned' : 'draft'}`} style={{ fontSize: '0.75rem' }}>
                          {schAttempted}/{sched.papers.length} attempted
                        </span>
                        {schEvaluated > 0 && (
                          <span className="pill info" style={{ fontSize: '0.75rem' }}>
                            {schTotal} / {schMax} marks
                          </span>
                        )}
                      </>
                    );
                  })()}
                </div>
                {sched.availableAt && (
                  <span className="muted" style={{ fontSize: '0.82rem' }}>
                    Available: {new Date(sched.availableAt).toLocaleString()}
                  </span>
                )}
              </div>

              {/* Papers table */}
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Paper</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                    <th>Submitted</th>
                    <th style={{ textAlign: 'right' }}>Marks Awarded</th>
                    <th>Evaluated On</th>
                    <th style={{ textAlign: 'right' }}>Answer Sheet</th>
                  </tr>
                </thead>
                <tbody>
                  {sched.papers.map((paper) => {
                    const pct = paper.marksAwarded != null && paper.totalMarks
                      ? Math.round((paper.marksAwarded / paper.totalMarks) * 100)
                      : null;
                    const statusLabel = paper.status === 'not_attempted'
                      ? 'Not Attempted'
                      : paper.status.replace(/_/g, ' ');
                    const statusClass = paper.status === 'evaluated'
                      ? 'published'
                      : ['submitted', 'assigned', 'under_review'].includes(paper.status)
                        ? 'assigned'
                        : 'draft';

                    return (
                      <tr key={paper.paperId}>
                        <td>
                          <strong style={{ fontSize: '0.92rem' }}>{paper.subjectName}</strong>
                          <div className="muted" style={{ fontSize: '0.76rem' }}>{paper.caLevel}</div>
                        </td>
                        <td>
                          <span style={{ fontWeight: 500 }}>{paper.title}</span>
                          <div className="muted" style={{ fontSize: '0.76rem' }}>{paper.paperType} · {paper.totalMarks} marks</div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`pill ${statusClass}`} style={{ fontSize: '0.76rem' }}>
                            {statusLabel}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.83rem' }} className="muted">
                          {paper.submittedAt ? new Date(paper.submittedAt).toLocaleString() : '—'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {paper.marksAwarded != null ? (
                            <span style={{
                              fontWeight: 700,
                              fontSize: '1rem',
                              color: pct >= 60 ? 'var(--ok)' : pct >= 40 ? 'var(--warn)' : 'var(--danger)',
                            }}>
                              {paper.marksAwarded}
                              <span className="muted" style={{ fontWeight: 400, fontSize: '0.8rem' }}> / {paper.totalMarks}</span>
                              <span className="muted" style={{ fontWeight: 400, fontSize: '0.75rem', marginLeft: '0.3rem' }}>({pct}%)</span>
                            </span>
                          ) : paper.status === 'not_attempted' ? (
                            <span className="muted">—</span>
                          ) : (
                            <span className="muted" style={{ fontSize: '0.85rem' }}>Pending review</span>
                          )}
                        </td>
                        <td style={{ fontSize: '0.82rem' }} className="muted">
                          {paper.evaluatedAt ? new Date(paper.evaluatedAt).toLocaleDateString() : '—'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {paper.answerFileUrl ? (
                            <a
                              href={paper.answerFileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="btn ghost"
                              style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                            >
                              View Sheet ↗
                            </a>
                          ) : (
                            <span className="muted" style={{ fontSize: '0.8rem' }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Reviewer feedback block */}
              {sched.papers.some((p) => p.feedback) && (
                <div style={{ marginTop: '0.85rem', padding: '0.85rem 1.15rem', background: 'var(--accent-soft, #f8fafc)', borderRadius: '10px', border: '1px solid var(--line, #e2e8f0)' }}>
                  <p style={{ margin: '0 0 0.5rem', fontWeight: 600, fontSize: '0.88rem' }}>Reviewer Remarks &amp; Feedback</p>
                  {sched.papers.filter((p) => p.feedback).map((p) => (
                    <div key={p.paperId} style={{ marginBottom: '0.4rem', fontSize: '0.88rem' }}>
                      <span className="muted" style={{ fontWeight: 600 }}>{p.subjectName} ({p.title}): </span>
                      <span>{p.feedback}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        ))
      )}
    </AdminPortalLayout>
  );
}
