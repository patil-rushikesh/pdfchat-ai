import { AppProvider } from './context/AppContext';
import { AuthProvider, useAuth } from './auth/AuthContext';
import ProtectedRoute from './auth/ProtectedRoute';
import Layout from './components/Layout';
import ToastContainer from './components/common/ToastContainer';
import { Analytics } from "@vercel/analytics/react";

const AuthenticatedApp = () => {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <AppProvider key={user.uid}>
      <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans">
        <Layout />
        <ToastContainer />
        <Analytics/>
      </div>
    </AppProvider>
  );
};

function App() {
  return (
    <AuthProvider>
      <ProtectedRoute>
        <AuthenticatedApp />
      </ProtectedRoute>
    </AuthProvider>
  );
}

export default App;
