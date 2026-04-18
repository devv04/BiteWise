import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, ReferenceLine } from 'recharts';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const Analytics = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get(`${API}/weekly-analytics`);
        setData(res.data);
      } catch (err) {
        console.error("Failed to load analytics: ", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div style={{ textAlign: 'center', marginTop: '100px', color: '#64748b' }}>Loading analytics...</div>;
  if (!data) return <div style={{ textAlign: 'center', marginTop: '100px', color: '#dc2626' }}>Failed to load analytics data.</div>;

  return (
    <div style={{ minHeight: 'calc(100vh - 73px)', background: 'linear-gradient(180deg,#f0fdf4 0%,#ecfdf5 40%,#f8fafc 100%)', padding: '40px 20px' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#1e293b' }}>Your Week in Review</h1>
          <p style={{ color: '#64748b' }}>Track your consistency and monitor your dietary habits.</p>
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          
          {/* Calorie Intake Chart */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: '20px', padding: '24px', boxShadow: '0 4px 24px rgba(0,0,0,0.04)' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1e293b', marginBottom: '20px' }}>Daily Calories</h3>
            <div style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} dx={-10} />
                  <Tooltip cursor={{ fill: 'rgba(34,197,94,0.05)' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 14px rgba(0,0,0,0.1)' }} />
                  <ReferenceLine y={data.calorieGoal} stroke="#d97706" strokeDasharray="3 3" label={{ position: 'top', value: 'Goal', fill: '#d97706', fontSize: 12 }} />
                  <Bar dataKey="calories" fill="#16a34a" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Health Score Chart */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: '20px', padding: '24px', boxShadow: '0 4px 24px rgba(0,0,0,0.04)' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1e293b', marginBottom: '20px' }}>Average Health Score</h3>
            <div style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} dx={-10} domain={[0, 100]} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 14px rgba(0,0,0,0.1)' }} />
                  <Line type="monotone" dataKey="healthScore" stroke="#16a34a" strokeWidth={4} dot={{ r: 6, fill: '#16a34a', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 8 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

        </div>
      </div>
    </div>
  );
};

export default Analytics;
