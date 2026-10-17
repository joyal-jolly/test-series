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

export function AdminPapers() {
  const [papers, setPapers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [form, setForm] = useState({
    title: '',
    subjectId: '',
    caLevel: 'Intermediate',
    paperType: 'Group 1',
    totalMarks: 100,
    durationMinutes: 180,
  });
  const [pdf, setPdf] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [fileInputKey, setFileInputKey] = useState(Date.now());

  // Edit paper modal state
  const [editingPaper, setEditingPaper] = useState(null);
  const [editPdf, setEditPdf] = useState(null);
  const [editError, setEditError] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  function reload() {
    api('/api/papers').then((d) => setPapers(d.papers));
  }

  useEffect(() => {
    reload();
    api('/api/papers/subjects').then((d) => {
      setSubjects(d.subjects);
      setForm((f) => ({ ...f, subjectId: d.subjects[0]?.id || '' }));
    });
  }, []);

  async function createPaper(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const body = new FormData();
      Object.entries(form).forEach(([k, v]) => body.append(k, v));
      body.append('status', 'published');
      if (pdf) body.append('pdf', pdf);
      await api('/api/admin/papers', { method: 'POST', body });
      setMessage('Question paper published successfully.');
      setForm((f) => ({
        ...f,
        title: '',
      }));
      setPdf(null);
      setFileInputKey(Date.now());
      reload();
    } catch (err) {
      setError(err.message);
    }
  }

  async function deletePaper(id) {
    if (!window.confirm('Are you sure you want to delete this question paper? This will also remove any attempts associated with it.')) {
      return;
    }
    setError('');
    setMessage('');
    try {
      await api(`/api/admin/papers/${id}`, { method: 'DELETE' });
      setMessage('Question paper deleted.');
      reload();
    } catch (err) {
      setError(err.message);
    }
  }

  function startEdit(p) {
    setEditingPaper({
      id: p.id,
      title: p.title || '',
      subjectId: p.subjectId || subjects[0]?.id || '',
      caLevel: p.caLevel || 'Intermediate',
      paperType: p.paperType === 'Group 2' ? 'Group 2' : 'Group 1',
      totalMarks: p.totalMarks || 100,
      durationMinutes: p.durationMinutes || 180,
      pdfUrl: p.pdfUrl || null,
    });
    setEditPdf(null);
    setEditError('');
  }

  async function saveEdit(e) {
    e.preventDefault();
    setEditError('');
    setEditLoading(true);
    try {
      const body = new FormData();
      body.append('title', editingPaper.title);
      body.append('subjectId', editingPaper.subjectId);
      body.append('caLevel', editingPaper.caLevel);
      body.append('paperType', editingPaper.paperType);
      body.append('totalMarks', editingPaper.totalMarks);
      body.append('durationMinutes', editingPaper.durationMinutes);
      if (editPdf) {
        body.append('pdf', editPdf);
      }
      await api(`/api/admin/papers/${editingPaper.id}`, {
        method: 'PATCH',
        body,
      });
      setEditingPaper(null);
      setEditPdf(null);
      setMessage('Question paper updated successfully.');
      reload();
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditLoading(false);
    }
  }

  return (
    <AdminPortalLayout>
      <div className="split-admin">
        <form className="panel form" onSubmit={createPaper}>
          <h2>Upload question paper</h2>
          <label>
            Title
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </label>
          <label>
            Subject
            <select value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <div className="row-2">
            <label>
              CA Level
              <select value={form.caLevel} onChange={(e) => setForm({ ...form, caLevel: e.target.value })}>
                <option>Intermediate</option>
                <option>Final</option>
              </select>
            </label>
            <label>
              Test
              <select value={form.paperType} onChange={(e) => setForm({ ...form, paperType: e.target.value })}>
                <option value="Group 1">Group 1</option>
                <option value="Group 2">Group 2</option>
              </select>
            </label>
          </div>
          <div className="row-2">
            <label>
              Total marks
              <input
                type="number"
                value={form.totalMarks}
                onChange={(e) => setForm({ ...form, totalMarks: e.target.value })}
              />
            </label>
            <label>
              Duration (min)
              <input
                type="number"
                value={form.durationMinutes}
                onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
              />
            </label>
          </div>
          <label>
            Question PDF (optional)
            <input
              key={fileInputKey}
              type="file"
              accept=".pdf"
              onChange={(e) => setPdf(e.target.files?.[0] || null)}
            />
          </label>
          {error && <p className="error">{error}</p>}
          {message && <p className="success">{message}</p>}
          <button className="btn primary">Publish paper</button>
        </form>

        <div className="panel">
          <h2>All papers</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {papers.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.title}</strong>
                    <div className="muted">
                      {p.caLevel} · {p.paperType} · {p.subjectName || 'Subject'}
                    </div>
                    {p.pdfUrl && (
                      <div style={{ marginTop: '0.25rem' }}>
                        <a href={p.pdfUrl} target="_blank" rel="noreferrer" className="muted" style={{ fontSize: '0.85rem', textDecoration: 'underline' }}>
                          View PDF
                        </a>
                      </div>
                    )}
                  </td>
                  <td>
                    <div className="table-actions">
                      <button type="button" className="btn subtle" onClick={() => startEdit(p)}>
                        Edit
                      </button>
                      <button type="button" className="btn subtle danger" onClick={() => deletePaper(p.id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {papers.length === 0 && (
                <tr>
                  <td colSpan={2} className="muted" style={{ textAlign: 'center', padding: '2rem' }}>
                    No question papers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingPaper && (
        <div className="modal-backdrop" onClick={() => setEditingPaper(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>Edit question paper</h2>
              <button
                type="button"
                className="btn subtle"
                onClick={() => setEditingPaper(null)}
                style={{ padding: '0.35rem 0.75rem', borderRadius: '50%' }}
              >
                ✕
              </button>
            </div>
            <form className="form" onSubmit={saveEdit}>
              <label>
                Title
                <input
                  value={editingPaper.title}
                  onChange={(e) => setEditingPaper({ ...editingPaper, title: e.target.value })}
                  required
                />
              </label>
              <label>
                Subject
                <select
                  value={editingPaper.subjectId}
                  onChange={(e) => setEditingPaper({ ...editingPaper, subjectId: e.target.value })}
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="row-2">
                <label>
                  CA Level
                  <select
                    value={editingPaper.caLevel}
                    onChange={(e) => setEditingPaper({ ...editingPaper, caLevel: e.target.value })}
                  >
                    <option>Intermediate</option>
                    <option>Final</option>
                  </select>
                </label>
                <label>
                  Test
                  <select
                    value={editingPaper.paperType}
                    onChange={(e) => setEditingPaper({ ...editingPaper, paperType: e.target.value })}
                  >
                    <option value="Group 1">Group 1</option>
                    <option value="Group 2">Group 2</option>
                  </select>
                </label>
              </div>
              <div className="row-2">
                <label>
                  Total marks
                  <input
                    type="number"
                    value={editingPaper.totalMarks}
                    onChange={(e) => setEditingPaper({ ...editingPaper, totalMarks: e.target.value })}
                  />
                </label>
                <label>
                  Duration (min)
                  <input
                    type="number"
                    value={editingPaper.durationMinutes}
                    onChange={(e) => setEditingPaper({ ...editingPaper, durationMinutes: e.target.value })}
                  />
                </label>
              </div>
              <label>
                Current PDF
                {editingPaper.pdfUrl ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
                    <a href={editingPaper.pdfUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>
                      View current file ({editingPaper.pdfUrl.split('/').pop()})
                    </a>
                  </div>
                ) : (
                  <span className="muted">No PDF file currently uploaded</span>
                )}
              </label>
              <label>
                Replace / Upload new PDF
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setEditPdf(e.target.files?.[0] || null)}
                />
              </label>
              {editError && <p className="error">{editError}</p>}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button type="button" className="btn ghost" onClick={() => setEditingPaper(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn primary" disabled={editLoading}>
                  {editLoading ? 'Saving…' : 'Save changes'}
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
