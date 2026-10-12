import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loading">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    const dest = user.role === 'admin' ? '/admin' : user.role === 'reviewer' ? '/reviewer' : '/student';
    return <Navigate to={dest} replace />;
  }
  return children;
}
