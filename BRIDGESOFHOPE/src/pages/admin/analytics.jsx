import { Navigate } from 'react-router-dom';

/**
 * Analytics lives on the admin dashboard. This route keeps old bookmarks working.
 */
export default function Analytics() {
  return <Navigate to="/admin-dashboard#admin-analytics" replace />;
}
