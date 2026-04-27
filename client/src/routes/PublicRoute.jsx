import { Navigate } from "react-router-dom";
import PropTypes from "prop-types";
import useAuthStore from '../stores/useAuthStore';
import FullPageLoader from "../components/shared/FullPageLoader";

function PublicRoute({ children }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrated = useAuthStore((state) => state.isHydrated);

  if (!isHydrated) {
    return <FullPageLoader text="Завантаження..." />;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
}

PublicRoute.propTypes = {
  children: PropTypes.node.isRequired,
};

export default PublicRoute;
