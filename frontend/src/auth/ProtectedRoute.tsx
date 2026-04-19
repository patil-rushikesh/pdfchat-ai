import type React from 'react';
import { useEffect } from 'react';
import Login from '../components/Login';
import { useAuth } from './useAuth';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAuthLoading } = useAuth();

  useEffect(() => {
    if (isAuthLoading) return;

    const path = window.location.pathname;
    if (!user && path !== '/login' && path !== '/signup') {
      window.history.replaceState({}, '', '/login');
    }
    if (user && (path === '/login' || path === '/signup')) {
      window.history.replaceState({}, '', '/pdf');
    }
  }, [isAuthLoading, user]);

  if (isAuthLoading) {
    return (
      <div className="min-h-screen grid place-items-center bg-white text-slate-900">
        <div className="text-sm font-medium text-slate-600">Loading your workspace...</div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
