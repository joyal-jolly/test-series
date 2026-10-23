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
        .catch(() => {});
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
  const [expandedGroup, setExpandedGroup] = useState(null);
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {groups.map((g) => {
            const isExpanded = expandedGroup === g.id;
            const expectedSubjects = g.numSubjectsPerSchedule || 3;

            return (
              <div key={g.id} className="panel group-panel" style={{ padding: '1.25rem 1.5rem', borderRadius: '12px' }}>
                {/* Group Header */}
                <div
                  className="group-header"
                  onClick={() => setExpandedGroup(isExpanded ? null : g.id)}
                  style={{
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    userSelect: 'none',
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '1.2rem' }}>
                      <span style={{ fontSize: '0.85rem', transition: 'transform 0.2s', display: 'inline-block', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                        ▶
                      </span>
                      {g.name}
                    </h3>
                    {g.description && <p className="muted" style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>{g.description}</p>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                    <span className="pill info" style={{ fontSize: '0.8rem' }}>
                      {g.numSchedules} Schedules · {expectedSubjects} Subjects/Schedule
                    </span>
                    <span className="pill published" style={{ fontSize: '0.8rem' }}>
                      {g.totalUploadedPapers || 0} / {g.totalExpectedPapers || (g.numSchedules * expectedSubjects)} Papers
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
                  </div>
                </div>

                {/* Schedules Under this Group */}
                {isExpanded && (
                  <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border, #eee)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {g.schedules.map((sched) => {
                      const papers = sched.papers || [];
                      const canAddMore = papers.length < expectedSubjects;

                      return (
                        <div
                          key={sched.scheduleNumber}
                          style={{
                            border: '1px solid var(--border, #e5e7eb)',
                            borderRadius: '10px',
                            background: '#fafafa',
                            overflow: 'hidden',
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
                )}
              </div>
            );
          })}
        </div>
      )}

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
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'reviewer',
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function reload() {
    api('/api/admin/users').then((d) => setUsers(d.users));
  }

  useEffect(() => {
    reload();
  }, []);

  async function createUser(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await api('/api/admin/users', {
        method: 'POST',
        body: {
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
          profile:
            form.role === 'reviewer'
              ? { qualification: 'CA' }
              : {},
        },
      });
      setMessage('User created.');
      setForm({ name: '', email: '', password: '', role: 'reviewer' });
      reload();
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteUser(u) {
    if (!window.confirm(`Are you sure you want to delete ${u.name} (${u.email})? This action cannot be undone.`)) {
      return;
    }
    setError('');
    setMessage('');
    try {
      await api(`/api/admin/users/${u.id}`, { method: 'DELETE' });
      setMessage(`User "${u.name}" deleted.`);
      reload();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <AdminPortalLayout>
      <div className="split-admin">
        <form className="panel form" onSubmit={createUser}>
          <h2>Add user</h2>
          <label>
            Name
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </label>
          <label>
            Role
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="reviewer">Reviewer</option>
              <option value="student">Student</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          {error && <p className="error">{error}</p>}
          {message && <p className="success">{message}</p>}
          <button className="btn primary">Create</button>
        </form>
        <div className="panel">
          <h2>Users</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>{u.status}</td>
                  <td>
                    <div className="table-actions">
                      <button
                        type="button"
                        className="btn subtle danger"
                        onClick={() => deleteUser(u)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminPortalLayout>
  );
}
