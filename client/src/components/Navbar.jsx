import { Link, useLocation } from 'react-router-dom';
import NotificationBell from './NotificationBell.jsx';
import { getUser } from '../auth';
import { BASE_URL } from '../api';

const ico = { width: 18, height: 18, flexShrink: 0 };

const Calendar = () => (
  <svg style={ico} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const Journal = () => (
  <svg style={ico} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
  </svg>
);
const UserIco = () => (
  <svg style={ico} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);

export default function Navbar() {
  const path = useLocation().pathname;
  const user = getUser();
  const avatarSrc = user?.avatar ? `${BASE_URL}${user.avatar}` : null;
  return (
    <nav className="navbar">
      <Link to="/dashboard" className="navbar-brand">Collab</Link>
      <div className="navbar-links">
        <NotificationBell />
        <Link to="/calendar" className={`nav-link${path === '/calendar' ? ' active' : ''}`}>
          <Calendar />
          <span className="nav-text">Календар</span>
        </Link>
        <Link to="/grades" className={`nav-link${path === '/grades' ? ' active' : ''}`}>
          <Journal />
          <span className="nav-text">Журнал оцінок</span>
        </Link>
        <Link to="/profile" className={`nav-link${path === '/profile' ? ' active' : ''}`}>
          {avatarSrc
            ? <img src={avatarSrc} alt="" style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            : <UserIco />}
          <span className="nav-text">Профіль</span>
        </Link>
      </div>
    </nav>
  );
}