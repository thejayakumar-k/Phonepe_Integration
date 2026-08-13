import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth, type Role } from '../auth/AuthContext';

interface ProtectedRouteProps {
  role: Role;
  children: ReactNode;
}

export function ProtectedRoute({ role, children }: ProtectedRouteProps) {
  const { session } = useAuth();

  if (!session || session.role !== role) {
    return <Navigate to={`/login/${role}`} replace />;
  }

  return <>{children}</>;
}
