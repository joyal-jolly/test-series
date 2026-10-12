import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
import PapersPage from './pages/PapersPage';
import PaperDetailPage from './pages/PaperDetailPage';
import { LoginPage, RegisterPage } from './pages/AuthPages';
import {
  AttemptPage,
  ResultPage,
  StudentDashboard,
  StudentSubmissions,
} from './pages/StudentPages';
import {
  AdminDashboard,
  AdminPapers,
  AdminSubmissions,
  AdminUsers,
} from './pages/AdminPages';
import {
  ReviewerAssignments,
  ReviewerDashboard,
  ReviewSubmissionPage,
} from './pages/ReviewerPages';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/papers" element={<PapersPage />} />
          <Route path="/papers/:id" element={<PaperDetailPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route
            path="/student"
            element={
              <ProtectedRoute roles={['student']}>
                <StudentDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/submissions"
            element={
              <ProtectedRoute roles={['student']}>
                <StudentSubmissions />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/attempts/:id"
            element={
              <ProtectedRoute roles={['student']}>
                <AttemptPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/attempts/:id/result"
            element={
              <ProtectedRoute roles={['student']}>
                <ResultPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin"
            element={
              <ProtectedRoute roles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/papers"
            element={
              <ProtectedRoute roles={['admin']}>
                <AdminPapers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/submissions"
            element={
              <ProtectedRoute roles={['admin']}>
                <AdminSubmissions />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute roles={['admin']}>
                <AdminUsers />
              </ProtectedRoute>
            }
          />

          <Route
            path="/reviewer"
            element={
              <ProtectedRoute roles={['reviewer']}>
                <ReviewerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reviewer/assignments"
            element={
              <ProtectedRoute roles={['reviewer']}>
                <ReviewerAssignments />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reviewer/assignments/:id"
            element={
              <ProtectedRoute roles={['reviewer']}>
                <ReviewSubmissionPage />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
