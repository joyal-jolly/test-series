import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PublicLayout } from '../components/Layouts';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

export default function PaperDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [paper, setPaper] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api(`/api/papers/${id}`)
      .then((d) => setPaper(d.paper))
      .catch((e) => setError(e.message));
  }, [id]);

  async function attempt() {
    if (!user) {
      navigate(`/login?next=/papers/${id}`);
      return;
    }
    if (user.role !== 'student') {
      setError('Only students can attempt papers.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const data = await api('/api/student/start', {
        method: 'POST',
        body: { questionPaperId: id },
      });
      navigate(`/student/attempts/${data.attempt.id}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (error && !paper) {
    return (
      <PublicLayout>
        <section className="page-band">
          <p className="error">{error}</p>
        </section>
      </PublicLayout>
    );
  }

  if (!paper) {
    return (
      <PublicLayout>
        <section className="page-band">
          <p className="muted">Loading…</p>
        </section>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <section className="page-band">
        <div className="detail-layout">
          <div>
            <div className="meta">
              <span>{paper.caLevel}</span>
              <span>{paper.paperType}</span>
              <span>{paper.subjectName}</span>
            </div>
            <h1>{paper.title}</h1>
            <p className="lede">{paper.description}</p>
            <div className="stat-row">
              <div>
                <strong>{paper.totalMarks}</strong>
                <span>Total marks</span>
              </div>
              <div>
                <strong>{paper.durationMinutes}</strong>
                <span>Minutes</span>
              </div>
              <div>
                <strong>{paper.questions?.length || 0}</strong>
                <span>Questions</span>
              </div>
            </div>
            {error && <p className="error">{error}</p>}
            <div className="cta-row">
              <button className="btn primary lg" onClick={attempt} disabled={busy}>
                {busy ? 'Starting…' : 'Attempt this paper'}
              </button>
            </div>
          </div>
          <aside className="panel">
            <h3>Questions overview</h3>
            <ul className="q-list">
              {(paper.questions || []).map((q) => (
                <li key={q.id}>
                  <span>Q{q.number}</span>
                  <p>{q.prompt}</p>
                  <em>{q.maxMarks} marks</em>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </section>
    </PublicLayout>
  );
}
