import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

type ProtectedRouteProps = {
  allowedRoles?: ('admin' | 'cashier' | 'chef' | 'waiter' | 'customer')[];
  redirectTo?: string;
};

export const ProtectedRoute = ({
  allowedRoles = [],
  redirectTo = '/login',
}: ProtectedRouteProps) => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to={redirectTo} replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
};

export const AdminRoute = () => (
  <ProtectedRoute allowedRoles={['admin']} redirectTo="/admin/login" />
);

export const StaffRoute = () => (
  <ProtectedRoute allowedRoles={['admin', 'cashier', 'chef', 'waiter']} />
);

export const CustomerRoute = () => (
  <ProtectedRoute allowedRoles={['customer']} redirectTo="/login" />
);
