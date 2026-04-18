import React, { useState, useEffect, useRef, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { AuthContext } from '../AuthContext';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const Dashboard = () => {
  const { user } = useContext(AuthContext);
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [dailySummary, setDailySummary] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Chat state
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  const fetchData = async () => {
    try {
      const [histRes, summaryRes] = await Promise.all([
        axios.get(`${API}/history`),
        axios.get(`${API}/daily-summary`)
      ]);
      setHistory(histRes.data);
      setDailySummary(summaryRes.data);
    } catch (err) {
      console.warn('Could not fetch data from server.');
    }
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    let stream = null;
    if (navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then((s) => {
          stream = s;
          if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => { }); }
        })
        .catch(() => { });
    }
    return () => { if (stream) stream.getTracks().forEach(t => t.stop()); };
  }, []);

  useEffect(() => {
    if (error) { const t = setTimeout(() => setError(null), 5000); return () => clearTimeout(t); }
  }, [error]);

  const selectFile = (f) => {
    if (!f.type.startsWith('image/')) { setError('Please upload a valid image file'); return; }
    if (f.size > 10 * 1024 * 1024) { setError('Image too large (max 10MB)'); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setError(null);
  };

  const handleCameraClick = () => {
    if (videoRef.current && canvasRef.current && videoRef.current.videoWidth) {
      const ctx = canvasRef.current.getContext('2d');
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      ctx.drawImage(videoRef.current, 0, 0);
      canvasRef.current.toBlob((blob) => {
        selectFile(new File([blob], 'photo.jpg', { type: 'image/jpeg' }));
      }, 'image/jpeg', 0.95);
    } else {
      setError('Camera not ready. Try uploading a file instead.');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) selectFile(e.dataTransfer.files[0]);
  };

  const handleSubmit = async () => {
    if (!file) { setError('Please capture or upload an image first'); return; }
    setLoading(true); setError(null); setResult(null); setChatHistory([]);
    const formData = new FormData();
    formData.append('image', file);
    try {
      const res = await axios.post(`${API}/analyze`, formData, { timeout: 120000 });
      if (res.data.error) { setError(res.data.error); return; }
      setResult(res.data);
      fetchData();
    } catch (err) {
      if (err.code === 'ECONNABORTED') setError('Analysis timed out. Try again.');
      else if (err.response) setError(err.response.data?.error || 'Server error');
      else if (err.request) setError('Cannot connect to server. Is the backend running?');
      else setError('Unexpected error occurred.');
    } finally { setLoading(false); }
  };

  const sc = (score) => {
    if (score === 'Healthy') return { c: '#16a34a', bg: 'rgba(22,163,74,0.10)', emoji: '🥗' };
    if (score === 'Moderately Healthy') return { c: '#d97706', bg: 'rgba(217,119,6,0.10)', emoji: '🍎' };
    if (score === 'Unhealthy') return { c: '#dc2626', bg: 'rgba(220,38,38,0.10)', emoji: '🍔' };
    return { c: '#64748b', bg: 'rgba(100,116,139,0.08)', emoji: '❓' };
  };

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatMessage.trim() || !result?.id) return;
    
    const userMsg = chatMessage.trim();
    setChatHistory(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatMessage('');
    setChatLoading(true);

    try {
      const res = await axios.post(`${API}/chat/${result.id}`, { message: userMsg });
      setChatHistory(prev => [...prev, { role: 'ai', content: res.data.reply }]);
    } catch (err) {
      setChatHistory(prev => [...prev, { role: 'ai', content: 'Sorry, I could not process that request right now.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; font-family:'Inter',sans-serif; }
        body { background:#f0fdf4; color:#1e293b; }
        ::-webkit-scrollbar { width:6px; } ::-webkit-scrollbar-thumb { background:rgba(0,0,0,0.12); border-radius:3px; }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:1} }
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        .shimmer { background:linear-gradient(90deg,rgba(34,197,94,0.04) 0%,rgba(34,197,94,0.10) 50%,rgba(34,197,94,0.04) 100%); background-size:200% 100%; animation:shimmer 1.5s linear infinite; }
      `}} />

      <div style={{ minHeight: 'calc(100vh - 73px)', background: 'linear-gradient(180deg,#f0fdf4 0%,#ecfdf5 40%,#f8fafc 100%)', padding: '20px 16px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

          {/* ===== DAILY NUTRITION TRACKER ===== */}
          {dailySummary && dailySummary.totalScans > 0 ? (
            <motion.section style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: '20px', padding: '32px', marginBottom: '28px', boxShadow: '0 4px 24px rgba(0,0,0,0.04)' }}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
                <span style={{ fontSize: '1.2rem' }}>🎯</span>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1e293b' }}>Today's Nutrition</h2>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '32px', alignItems: 'center' }}>
                {/* Calorie Ring */}
                <div style={{ position: 'relative', width: '180px', height: '180px', margin: '0 auto' }}>
                  <svg viewBox="0 0 120 120" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                    <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(34,197,94,0.10)" strokeWidth="10" />
                    <motion.circle cx="60" cy="60" r="52" fill="none" stroke="url(#calorieGrad)" strokeWidth="10" strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 52}`}
                      initial={{ strokeDashoffset: 2 * Math.PI * 52 }}
                      animate={{ strokeDashoffset: 2 * Math.PI * 52 * (1 - (dailySummary.calorieProgress / 100)) }}
                      transition={{ duration: 1.5, ease: 'easeOut' }}
                    />
                    <defs>
                      <linearGradient id="calorieGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#16a34a" />
                        <stop offset="100%" stopColor="#059669" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '2rem', fontWeight: 800, color: '#1e293b' }}>{dailySummary.totalCalories}</span>
                    <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>/ {dailySummary.calorieGoal} kcal</span>
                  </div>
                </div>

                {/* Macros */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <MacroBar label="Protein" value={dailySummary.macros.protein} max={100} color="#7c3aed" unit="g" />
                  <MacroBar label="Carbs" value={dailySummary.macros.carbohydrates} max={300} color="#d97706" unit="g" />
                  <MacroBar label="Fat" value={dailySummary.macros.fat} max={80} color="#dc2626" unit="g" />
                  <MacroBar label="Fiber" value={dailySummary.macros.fiber} max={30} color="#16a34a" unit="g" />
                </div>
              </div>

              {/* Foods eaten today */}
              {dailySummary.foodsEaten?.length > 0 && (
                <div style={{ marginTop: '24px', borderTop: '1px solid rgba(34,197,94,0.10)', paddingTop: '20px' }}>
                  <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>Today's Log</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {dailySummary.foodsEaten.map((food, i) => (
                      <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '99px', background: sc(food.healthScore).bg, border: `1px solid ${sc(food.healthScore).c}25`, fontSize: '0.8rem', fontWeight: 600, color: sc(food.healthScore).c }}>
                        {sc(food.healthScore).emoji} {food.name}
                        <span style={{ color: '#94a3b8', fontWeight: 400 }}>· {Math.round(food.calories)} kcal</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </motion.section>
          ) : (
            <motion.section style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: '20px', padding: '32px', marginBottom: '28px', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.04)' }}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
               <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1e293b' }}>Welcome, {user?.username}!</h2>
               <p style={{ color: '#64748b', marginTop: '8px' }}>Scan your first meal today to start tracking against your {user?.calorieGoal} kcal goal.</p>
            </motion.section>
          )}

          {/* ===== SCAN SECTION ===== */}
          <motion.section style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: '20px', padding: '32px', marginBottom: '28px', boxShadow: '0 4px 24px rgba(0,0,0,0.04)' }}
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
              <span style={{ fontSize: '1.2rem' }}>📸</span>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1e293b' }}>Scan Food</h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              {/* Camera */}
              <div style={{ position: 'relative', background: '#f1f5f9', borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(34,197,94,0.12)' }}>
                <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '260px', objectFit: 'cover', display: 'block' }} />
                <canvas ref={canvasRef} style={{ display: 'none' }} />
                <motion.button onClick={handleCameraClick}
                  style={{ position: 'absolute', bottom: '12px', left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg,#16a34a,#059669)', color: 'white', border: 'none', padding: '10px 28px', borderRadius: '12px', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', boxShadow: '0 4px 14px rgba(22,163,74,0.3)' }}
                  whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  📸 Capture
                </motion.button>
              </div>

              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: isDragging ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.6)', border: isDragging ? '2px dashed #16a34a' : '2px dashed rgba(34,197,94,0.25)', borderRadius: '16px', height: '260px', cursor: 'pointer', transition: 'all 0.2s' }}>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && selectFile(e.target.files[0])} style={{ display: 'none' }} />
                {preview ? (
                  <img src={preview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '14px' }} />
                ) : (
                  <>
                    <span style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🖼️</span>
                    <p style={{ fontSize: '0.9rem', fontWeight: 600, color: '#475569' }}>Drop image here or click to upload</p>
                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>JPEG, PNG — max 10MB</p>
                  </>
                )}
              </div>
            </div>

            <motion.button onClick={handleSubmit} disabled={loading}
              style={{ width: '100%', padding: '16px', background: loading ? '#e2e8f0' : 'linear-gradient(135deg,#16a34a,#059669)', color: loading ? '#64748b' : 'white', border: 'none', borderRadius: '14px', fontSize: '1rem', fontWeight: 700, cursor: loading ? 'wait' : 'pointer', transition: 'all 0.2s', boxShadow: loading ? 'none' : '0 4px 14px rgba(22,163,74,0.25)' }}
              whileHover={loading ? {} : { scale: 1.02 }} whileTap={loading ? {} : { scale: 0.98 }}>
              {loading ? '🔍 Analyzing...' : '🚀 Analyze Food'}
            </motion.button>

            <AnimatePresence>
              {error && (
                <motion.div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 18px', borderRadius: '12px', background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.15)' }}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                  <span>⚠️</span>
                  <p style={{ flex: 1, color: '#dc2626', fontSize: '0.875rem', fontWeight: 500 }}>{error}</p>
                  <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '1.2rem', cursor: 'pointer' }}>×</button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>

          {/* ===== LOADING SKELETON ===== */}
          <AnimatePresence>
            {loading && (
              <motion.section style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: '20px', padding: '32px', marginBottom: '28px', boxShadow: '0 4px 24px rgba(0,0,0,0.04)' }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div className="shimmer" style={{ height: '28px', width: '50%', borderRadius: '8px' }} />
                  <div className="shimmer" style={{ height: '6px', borderRadius: '99px' }} />
                  <div className="shimmer" style={{ height: '14px', width: '80%', borderRadius: '6px' }} />
                  <div className="shimmer" style={{ height: '14px', width: '65%', borderRadius: '6px' }} />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '10px', marginTop: '8px' }}>
                    {[1, 2, 3, 4, 5].map(i => <div key={i} className="shimmer" style={{ height: '64px', borderRadius: '12px' }} />)}
                  </div>
                </div>
                <p style={{ textAlign: 'center', color: '#64748b', marginTop: '20px', fontWeight: 600, animation: 'pulse 1.5s infinite' }}>🔍 AI is analyzing your food...</p>
              </motion.section>
            )}
          </AnimatePresence>

          {/* ===== RESULT ===== */}
          <AnimatePresence>
            {result && !loading && (
              <motion.section style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: '20px', padding: '32px', marginBottom: '28px', boxShadow: '0 4px 24px rgba(0,0,0,0.04)' }}
                initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ type: 'spring', stiffness: 100 }}>

                <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Detected</p>
                  <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1e293b', margin: '4px 0 14px' }}>{result.foodName || 'Unknown Food'}</h2>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 20px', borderRadius: '99px', background: sc(result.healthScore).bg, border: `1px solid ${sc(result.healthScore).c}30`, fontSize: '1rem', fontWeight: 700, color: sc(result.healthScore).c }}>
                    {sc(result.healthScore).emoji} {result.healthScore}
                  </span>
                </div>

                <div style={{ height: '5px', borderRadius: '99px', background: 'rgba(34,197,94,0.10)', marginBottom: '28px', overflow: 'hidden' }}>
                  <motion.div style={{ height: '100%', borderRadius: '99px', background: sc(result.healthScore).c }}
                    initial={{ width: 0 }}
                    animate={{ width: result.healthScore === 'Healthy' ? '100%' : result.healthScore === 'Moderately Healthy' ? '55%' : '20%' }}
                    transition={{ duration: 1, delay: 0.2 }} />
                </div>

                <div style={{ padding: '16px 20px', borderRadius: '14px', background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.10)', marginBottom: '20px' }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Analysis</p>
                  <p style={{ color: '#334155', lineHeight: 1.7, fontSize: '0.9rem' }}>{result.reason}</p>
                </div>

                {result.nutrientValues && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '10px', marginBottom: '20px' }}>
                    {Object.entries(result.nutrientValues).map(([key, val]) => (
                      <div key={key} style={{ textAlign: 'center', padding: '14px 8px', borderRadius: '14px', background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.10)' }}>
                        <p style={{ fontSize: '0.65rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>{key}</p>
                        <p style={{ fontSize: '1rem', fontWeight: 700, color: '#16a34a' }}>{val}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <InfoCard title="⚠️ Warnings" items={result.warnings} color="#d97706" />
                  <InfoCard title="🧬 Allergens" items={result.allergens} color="#dc2626" />
                  <InfoCard title="🩺 Disease Risks" items={result.diseaseRisk} color="#b91c1c" />
                  <InfoCard title="💡 Suggestions" items={result.suggestions} color="#16a34a" />
                </div>

                {/* ===== AI CHATBOT ===== */}
                <div style={{ marginTop: '32px', background: 'rgba(241,245,249,0.6)', borderRadius: '16px', border: '1px solid rgba(226,232,240,0.8)', overflow: 'hidden' }}>
                  <div style={{ background: '#f8fafc', padding: '16px 20px', borderBottom: '1px solid rgba(226,232,240,0.8)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.2rem' }}>💬</span>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>Ask AI about this meal</h3>
                  </div>
                  
                  {chatHistory.length > 0 && (
                    <div style={{ padding: '20px', maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {chatHistory.map((msg, i) => (
                        <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                          style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%', background: msg.role === 'user' ? '#16a34a' : 'white', color: msg.role === 'user' ? 'white' : '#334155', padding: '12px 16px', borderRadius: msg.role === 'user' ? '16px 16px 2px 16px' : '16px 16px 16px 2px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', border: msg.role === 'user' ? 'none' : '1px solid rgba(226,232,240,0.8)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                          {msg.content}
                        </motion.div>
                      ))}
                      {chatLoading && (
                        <div style={{ alignSelf: 'flex-start', background: 'white', padding: '12px 16px', borderRadius: '16px 16px 16px 2px', border: '1px solid rgba(226,232,240,0.8)', fontSize: '0.9rem', color: '#64748b', display: 'flex', gap: '4px' }}>
                          <span className="shimmer" style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#94a3b8' }} />
                          <span className="shimmer" style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#94a3b8', animationDelay: '0.2s' }} />
                          <span className="shimmer" style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#94a3b8', animationDelay: '0.4s' }} />
                        </div>
                      )}
                    </div>
                  )}

                  <form onSubmit={handleChatSubmit} style={{ display: 'flex', padding: '16px', borderTop: '1px solid rgba(226,232,240,0.8)', background: 'white' }}>
                    <input type="text" placeholder="Is this safe for people with diabetes...?" value={chatMessage} onChange={e => setChatMessage(e.target.value)} disabled={chatLoading} style={{ flex: 1, padding: '12px 16px', background: '#f1f5f9', border: 'none', borderRadius: '12px', outline: 'none', fontSize: '0.9rem', color: '#1e293b' }} />
                    <button type="submit" disabled={!chatMessage.trim() || chatLoading} style={{ marginLeft: '12px', padding: '0 20px', background: chatMessage.trim() ? '#16a34a' : '#94a3b8', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 600, cursor: chatMessage.trim() && !chatLoading ? 'pointer' : 'not-allowed', transition: 'background 0.2s' }}>
                      Send
                    </button>
                  </form>
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          {/* ===== HISTORY ===== */}
          <motion.section style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: '20px', padding: '32px', marginBottom: '40px', boxShadow: '0 4px 24px rgba(0,0,0,0.04)' }}
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <span style={{ fontSize: '1.2rem' }}>📋</span>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1e293b' }}>Scan History</h2>
            </div>

            {history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                <p style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🍽️</p>
                <p style={{ fontWeight: 500 }}>No scans yet — analyze your first food above!</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {history.slice(0, 8).map((item, i) => (
                  <motion.div key={item.id || i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderRadius: '12px', background: 'rgba(34,197,94,0.03)', border: '1px solid rgba(34,197,94,0.08)' }}
                    initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '1.4rem' }}>{sc(item.healthScore).emoji}</span>
                      <div>
                        <p style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.9rem' }}>{item.foodName || 'Unknown'}</p>
                        <p style={{ fontSize: '0.75rem', fontWeight: 600, color: sc(item.healthScore).c }}>{item.healthScore}</p>
                      </div>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{item.timestamp ? new Date(item.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</span>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.section>

        </div>
      </div>
    </>
  );
};

const MacroBar = ({ label, value, max, color, unit }) => {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>{label}</span>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color }}>{value}{unit}</span>
      </div>
      <div style={{ height: '8px', borderRadius: '99px', background: 'rgba(34,197,94,0.08)', overflow: 'hidden' }}>
        <motion.div
          style={{ height: '100%', borderRadius: '99px', background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
};

const InfoCard = ({ title, items, color }) => (
  <div style={{ padding: '16px 18px', borderRadius: '14px', background: 'rgba(34,197,94,0.03)', border: '1px solid rgba(34,197,94,0.08)' }}>
    <p style={{ fontSize: '0.8rem', fontWeight: 700, color, marginBottom: '10px' }}>{title}</p>
    {items?.map((item, i) => (
      <p key={i} style={{ fontSize: '0.8rem', color: '#475569', lineHeight: 1.8, display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
        <span style={{ color, fontSize: '0.5rem', marginTop: '6px' }}>●</span> {item}
      </p>
    ))}
  </div>
);

export default Dashboard;
