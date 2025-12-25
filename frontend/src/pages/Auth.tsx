import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import AuthForm from '../components/auth/AuthForm';

export default function Auth() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-caky-bg">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-caky-primary border-t-transparent"></div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <AuthForm />;
}
