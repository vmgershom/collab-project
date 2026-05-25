import { Link, useLocation } from 'react-router-dom';

export default function Navbar() {
  const path = useLocation().pathname;
  return (
    <nav className="navbar">
      <Link to="/dashboard" className="navbar-brand">Collab</Link>
      <div className="navbar-links">
        <Link to="/calendar" className={`nav-link${path === '/calendar' ? ' active' : ''}`}>Календар</Link>
        <Link to="/grades" className={`nav-link${path === '/grades' ? ' active' : ''}`}>Журнал оцінок</Link>
        <Link to="/profile" className={`nav-link${path === '/profile' ? ' active' : ''}`}>Профіль</Link>
      </div>
    </nav>
  );
}