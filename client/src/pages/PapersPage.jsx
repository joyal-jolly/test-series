import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PublicLayout } from '../components/Layouts';
import { api } from '../lib/api';

export default function PapersPage() {
  const [papers, setPapers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [filters, setFilters] = useState({ q: '', caLevel: '', subjectId: '', paperType: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/api/papers/subjects').then((d) => setSubjects(d.subjects));
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));
    api(`/api/papers?${params}`)
      .then((d) => setPapers(d.papers))
      .finally(() => setLoading(false));
  }, [filters]);

  return (
    <PublicLayout>
      <section className="page-band">
        <div className="section-head">
          <h1>Question paper library</h1>
          <p>Browse published papers. Login as a student to attempt and submit answers.</p>
        </div>

        <div className="filters">
          <input
            placeholder="Search title, chapter…"
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
          <select
            value={filters.paperType}
            onChange={(e) => setFilters({ ...filters, paperType: e.target.value })}
          >
            <option value="">All groups & types</option>
            <option value="Group 1">Group 1</option>
            <option value="Group 2">Group 2</option>
            <option>Chapter Test</option>
            <option>Mock Test</option>
            <option>Revision Test</option>
            <option>Model Exam</option>
          </select>
        </div>

        {loading ? (
          <p className="muted">Loading papers…</p>
        ) : papers.length === 0 ? (
          <p className="muted">No papers match your filters.</p>
        ) : (
          <div className="paper-grid">
            {papers.map((p) => (
              <Link key={p.id} to={`/papers/${p.id}`} className="paper-card">
                <div className="meta">
                  <span>{p.caLevel}</span>
                  <span>{p.paperType}</span>
                </div>
                <h3>{p.title}</h3>
                <p>{p.subjectName}</p>
                <div className="paper-stats">
                  <span>{p.totalMarks} marks</span>
                  <span>{p.durationMinutes} min</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </PublicLayout>
  );
}
