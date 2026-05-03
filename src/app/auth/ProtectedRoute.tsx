import { Navigate, useLocation } from 'react-router-dom';
import { type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import type { Role } from '../types/schema';
import { PageLoadingSkeleton } from '../components/LoadingSkeleton';

interface ProtectedRouteProps {
  children: ReactNode;
  requireRole?: Role | Role[];
}

export default function ProtectedRoute({ children, requireRole }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoadingSkeleton />;

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (requireRole) {
    const allowed = Array.isArray(requireRole) ? requireRole : [requireRole];
    if (!allowed.includes(user.role) && user.role !== 'superadmin') {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
}
