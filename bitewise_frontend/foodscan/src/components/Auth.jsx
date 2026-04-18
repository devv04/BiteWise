import React, { useState, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../AuthContext';
import { motion } from 'framer-motion';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const Auth = () => {
  const { login } = useContext(AuthContext);
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    username: '', password: '', age: 30, weight: 70, height: 170, goal: 'maintain'
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isLogin) {
        const res = await axios.post(`${API}/login`, { username: formData.username, password: formData.password });
        login(res.data);
      } else {
        await axios.post(`${API}/register`, formData);
        setIsLogin(true);
        setError("Registered successfully! Please log in.");
      }
    } catch (err) {
      setError(err.response?.data?.error || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg,#f0fdf4 0%,#ecfdf5 40%,#f8fafc 100%)', padding: '20px' }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        style={{ width: '100%', maxWidth: '400px', background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: '20px', padding: '32px', boxShadow: '0 4px 24px rgba(0,0,0,0.04)' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, background: 'linear-gradient(135deg,#16a34a,#059669)', WebkitBackgroundClip: 'text', color: 'transparent' }}>BiteWise</h1>
          <p style={{ color: '#64748b' }}>{isLogin ? 'Log in to track your nutrition' : 'Create an account'}</p>
        </div>

        {error && <p style={{ color: error.includes('success') ? '#16a34a' : '#dc2626', background: error.includes('success') ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)', padding: '10px', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '16px' }}>{error}</p>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <input required name="username" placeholder="Username" value={formData.username} onChange={handleChange} style={inputStyle} />
          <input required type="password" name="password" placeholder="Password" value={formData.password} onChange={handleChange} style={inputStyle} />
          
          {!isLogin && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <label style={labelStyle}>Age <input type="number" required name="age" value={formData.age} onChange={handleChange} style={inputStyle} /></label>
                <label style={labelStyle}>Weight (kg) <input type="number" required name="weight" value={formData.weight} onChange={handleChange} style={inputStyle} /></label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                 <label style={labelStyle}>Height (cm) <input type="number" required name="height" value={formData.height} onChange={handleChange} style={inputStyle} /></label>
                 <label style={labelStyle}>Goal 
                   <select name="goal" value={formData.goal} onChange={handleChange} style={{...inputStyle, padding: '11px'}}>
                     <option value="loss">Lose Weight</option>
                     <option value="maintain">Maintain</option>
                     <option value="gain">Gain Muscle</option>
                   </select>
                 </label>
              </div>
            </motion.div>
          )}

          <button type="submit" disabled={loading} style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg,#16a34a,#059669)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 700, cursor: loading ? 'wait' : 'pointer' }}>
            {loading ? 'Processing...' : (isLogin ? 'Log In' : 'Sign Up')}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.85rem', color: '#64748b' }}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <span onClick={() => setIsLogin(!isLogin)} style={{ color: '#16a34a', fontWeight: 600, cursor: 'pointer' }}>
            {isLogin ? 'Sign up' : 'Log in'}
          </span>
        </p>

      </motion.div>
    </div>
  );
};

const inputStyle = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid rgba(34,197,94,0.2)', outline: 'none', background: '#f8fafc', fontSize: '0.9rem' };
const labelStyle = { fontSize: '0.75rem', fontWeight: 600, color: '#475569', display: 'flex', flexDirection: 'column', gap: '4px' };

export default Auth;
