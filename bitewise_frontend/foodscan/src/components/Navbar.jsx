import React, { useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../AuthContext';
import { LogOut, Home, BarChart2 } from 'lucide-react';

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);
  const location = useLocation();

  if (!user) return null;

  return (
    <nav style={{ background: 'white', borderBottom: '1px solid rgba(0,0,0,0.05)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <img src="/logo.png" alt="Logo" style={{ height: '40px', filter: 'drop-shadow(0 2px 8px rgba(34,197,94,0.3))' }} />
        <h1 style={{ fontSize: '1.4rem', fontWeight: 900, background: 'linear-gradient(135deg,#16a34a,#059669)', WebkitBackgroundClip: 'text', color: 'transparent', margin: 0 }}>BiteWise</h1>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
        <Link to="/" style={{ ...linkStyle, color: location.pathname === '/' ? '#16a34a' : '#64748b' }}>
          <Home size={20} /> Dashboard
        </Link>
        <Link to="/analytics" style={{ ...linkStyle, color: location.pathname === '/analytics' ? '#16a34a' : '#64748b' }}>
          <BarChart2 size={20} /> Analytics
        </Link>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b', display: 'block' }}>{user.username}</span>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Goal: {user.calorieGoal} kcal</span>
        </div>
        <button onClick={logout} style={{ background: 'rgba(220,38,38,0.1)', color: '#dc2626', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <LogOut size={18} />
        </button>
      </div>
    </nav>
  );
};

const linkStyle = { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.95rem', fontWeight: 600, textDecoration: 'none', transition: 'color 0.2s' };

export default Navbar;
