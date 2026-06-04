import { Navigate, useLocation } from "react-router-dom";
import PropTypes from "prop-types";
import useAuthStore from '../stores/useAuthStore';
import FullPageLoader from "../components/shared/FullPageLoader";

function PublicRoute({ children }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const location = useLocation();

  if (!isHydrated) {
    return <FullPageLoader text="Завантаження..." />;
  }

  if (isAuthenticated) {
    const searchParams = new URLSearchParams(location.search);
    let returnTo = searchParams.get("returnTo") || "/";
    
    if (!returnTo.startsWith('/') || returnTo.startsWith('//')) {
      returnTo = '/';
    }

    return <Navigate to={returnTo} replace />;
  }

  return children;
}

PublicRoute.propTypes = {
  children: PropTypes.node.isRequired,
};

export default PublicRoute;
