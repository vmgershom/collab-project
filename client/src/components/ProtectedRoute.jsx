import { Navigate } from 'react-router-dom';
import { getToken } from '../auth.js';
import Navbar from './Navbar.jsx';

export default function ProtectedRoute({ children }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  return (
    <>
      <Navbar />
      {children}
    </>
  );
}