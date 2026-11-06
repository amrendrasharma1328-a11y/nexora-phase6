import { Navigate, useLocation } from 'react-router-dom';
import LoadingIndicator from '../ui/LoadingIndicator.jsx';
import { useSession } from '../../context/SessionContext.jsx';

/** Route guard: the workspace is only available while control is held. Everything else goes back to the start page. */
export default function RequireControl({ children }) {
  const { holdsControl, validating } = useSession();
  const location = useLocation();
  if (validating) {
    return <div className="flex min-h-screen items-center justify-center bg-bg"><LoadingIndicator label="Checking your control session" /></div>;
  }
  if (!holdsControl) return <Navigate to="/" replace state={{ reason: 'control-required', from: location.pathname }} />;
  return children;
}
