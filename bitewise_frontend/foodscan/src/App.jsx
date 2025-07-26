import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

const App = () => {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState(JSON.parse(localStorage.getItem('scanHistory') || '[]'));
  const [language, setLanguage] = useState('en');
  const [preview, setPreview] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('scanHistory', JSON.stringify(history));
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then((stream) => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch((err) => console.error('Video play error:', err));
          }
        })
        .catch((err) => {
          console.error('Camera access denied:', err);
          setError('Camera access denied. Use file upload instead! 📸');
        });
    }
  }, [history]);

  const handleCameraClick = () => {
    if (videoRef.current && canvasRef.current && videoRef.current.videoWidth) {
      const context = canvasRef.current.getContext('2d');
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
      canvasRef.current.toBlob((blob) => {
        const file = new File([blob], 'photo.jpg', { type: 'image/jpeg', quality: 0.95 });
        setFile(file);
        setPreview(URL.createObjectURL(blob));
      }, 'image/jpeg', 0.95);
    } else {
      setError('Camera not ready. Try again or upload a file! 📸');
    }
  };

  const handleFileUpload = (e) => {
    const uploadedFile = e.target.files[0];
    if (uploadedFile) {
      setFile(uploadedFile);
      setPreview(URL.createObjectURL(uploadedFile));
    }
  };

  const handleSubmit = async () => {
    if (!file) {
      setError('Please capture or upload an image! 📸');
      return;
    }
    setLoading(true);
    const formData = new FormData();
    formData.append('image', file);
    formData.append('language', language);
    formData.append('preferences', '{}');

    try {
      const response = await axios.post('http://localhost:5001/analyze', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(response.data);
      setHistory([{ ...response.data, timestamp: new Date().toISOString() }, ...history]);
    } catch (err) {
      setError('Oops! Scan failed. Try again! 😕');
    } finally {
      setLoading(false);
    }
  };

  const getHealthScoreColor = (score) => {
    if (score === 'Healthy') return 'bg-green-700';
    if (score === 'Moderately Healthy') return 'bg-gradient-to-r from-amber-400 to-yellow-500';
    return 'bg-red-500';
  };

  const getBackgroundColor = (score) => {
    if (score === 'Healthy') return 'bg-gradient-to-br from-[#7DBA88] to-[#FFAA6F]';
    if (score === 'Moderately Healthy') return 'bg-yellow-300';
    return 'bg-gradient-to-br from-[#FFAA6F] to-[#7DBA88]';
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
          @keyframes pulseGlow {
            0%, 100% { transform: scale(1); opacity: 0.85; filter: drop-shadow(0 0 12px rgba(255, 170, 111, 0.6)); }
            50% { transform: scale(1.06); opacity: 1; filter: drop-shadow(0 0 25px rgba(255, 170, 111, 0.9)); }
          }
          @keyframes logoFly {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-15px); }
          }
          @keyframes emblemZoom {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
          }
          @keyframes gradientShift {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          .glassmorphic {
            background: rgba(255, 255, 255, 0.25);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.5);
            box-shadow: 0 12px 48px rgba(0, 0, 0, 0.15);
          }
          .neumorphic {
            background: linear-gradient(145deg, #fff3d9, #f3e8ff);
            box-shadow: 8px 8px 20px rgba(0, 0, 0, 0.15), -8px -8px 20px rgba(255, 255, 255, 0.9);
          }
          .gradient-text {
            background: linear-gradient(90deg, #FFAA6F, #7DBA88, #FFF3D9, #FFAA6F);
            background-size: 200% 200%;
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
            animation: gradientShift 3s ease infinite;
          }
          .pulse-glow {
            animation: pulseGlow 2.5s ease-in-out infinite;
          }
          .logo-fly {
            animation: logoFly 4s ease-in-out infinite;
          }
          .emblem {
            animation: emblemZoom 3s ease-in-out infinite;
            border: 3px solid rgba(255, 170, 111, 0.5);
            box-shadow: 0 0 30px rgba(255, 170, 111, 0.7);
          }
          .hexagon {
            clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
          }
          .gif-float {
            position: absolute;
            pointer-events: none;
          }
          .gif-float.tenor { width: 100px; height: 100px; }
          .gif-float.source { width: 100px; height: 100px; }
          .gif-float.drink { width: 110px; height: 110px; }
          .gif-float.liver { width: 110px; height: 110px; }
          * {
            font-family: 'Inter', sans-serif;
          }
        `
      }} />
      <div className="min-h-screen bg-gradient-to-br from-[#FFAA6F] via-[#7DBA88] to-[#FFF3D9] flex flex-col items-center p-4 sm:p-8 md:p-12 text-gray-800 overflow-x-hidden relative">
        <motion.div
          className="mb-12 sm:mb-16 flex flex-col items-center"
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 1.4, type: 'spring', stiffness: 110 }}
        >
          <motion.img
            src="/logo.png"
            alt="BiteWise Logo"
            className="w-60 h-60 sm:w-80 sm:h-80 object-contain pulse-glow logo-fly"
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 1.2, type: 'spring', stiffness: 140 }}
          />
          <motion.h1
            className="text-7xl font-extrabold gradient-text mt-4 drop-shadow-lg"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 1, type: 'spring', stiffness: 130 }}
          >
            BiteWise
          </motion.h1>
          <p className="text-xl sm:text-2xl font-semibold text-gray-800 mt-2 text-center drop-shadow">
            You might ignore your health, but BiteWise won't let you.
          </p>
        </motion.div>

        <div className="space-y-20 w-full max-w-7xl mx-auto">
          {/* Scan Section */}
          <motion.div
            className="glassmorphic p-8 sm:p-10 md:p-16 rounded-2xl shadow-3xl"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1.2, type: 'spring', stiffness: 90 }}
          >
            <h2 className="text-5xl sm:text-6xl font-extrabold mb-10 gradient-text drop-shadow-lg">Scan Your Food 🍴</h2>
            <div className="space-y-14">
              <div>
                <label className="block text-xl sm:text-2xl font-medium mb-6 text-gray-800 drop-shadow">Capture or Upload Image</label>
                <div className="relative">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div className="relative neumorphic p-6 rounded-lg">
                      <video ref={videoRef} autoPlay className="w-full h-96 rounded-lg object-cover border-2 border-[#FFAA6F] overflow-hidden" />
                      <canvas ref={canvasRef} className="hidden" />
                      <motion.button
                        onClick={handleCameraClick}
                        className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-[#FFAA6F] to-[#7DBA88] text-white text-lg font-semibold py-2.5 px-6 rounded-lg shadow-lg hover:shadow-2xl transition-all duration-200 flex items-center"
                        whileHover={{ scale: 1.1, boxShadow: '0 0 15px rgba(255, 170, 111, 0.5)' }}
                        whileTap={{ scale: 0.95 }}
                      >
                        📸 Snap It!
                      </motion.button>
                    </div>
                    <div className="neumorphic p-6 rounded-lg">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="w-full text-sm text-gray-800 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-gradient-to-r file:from-[#FFAA6F] file:to-[#7DBA88] file:text-white file:font-semibold hover:file:from-[#FFB77C] hover:file:to-[#8ACA98] transition-all duration-200"
                      />
                      {preview && (
                        <div className="mt-6">
                          <p className="text-lg sm:text-xl font-semibold text-gray-800 mb-2 drop-shadow">Preview:</p>
                          <img src={preview} alt="Preview" className="w-full h-auto rounded-lg object-cover border-2 border-[#FFAA6F] shadow-lg" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xl sm:text-2xl font-medium mb-6 text-gray-800 drop-shadow">Language</label>
                <motion.select
                  className="w-full p-3 border-2 border-[#FFAA6F] rounded-lg bg-white/90 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#7DBA88] transition-all duration-200 neumorphic"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  whileFocus={{ scale: 1.05, boxShadow: '0 0 10px rgba(125, 186, 136, 0.5)' }}
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                </motion.select>
              </div>
              <motion.button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#FFAA6F] to-[#7DBA88] text-white py-3 px-6 rounded-lg text-lg sm:text-xl font-semibold shadow-lg hover:shadow-2xl transition-all duration-200 flex items-center justify-center"
                whileHover={{ scale: 1.05, boxShadow: '0 0 20px rgba(255, 170, 111, 0.7)' }}
                whileTap={{ scale: 0.95 }}
              >
                {loading ? (
                  <svg className="animate-spin h-5 w-5 mr-2 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                ) : (
                  'Analyze Food 🚀'
                )}
              </motion.button>
              {error && (
                <motion.p
                  className="text-red-500 mt-4 text-center font-semibold text-lg drop-shadow"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ type: 'spring', stiffness: 100 }}
                >
                  {error}
                </motion.p>
              )}
            </div>
          </motion.div>

          <AnimatePresence>
            {result && (
              <>
                <motion.div
                  className={`p-8 sm:p-10 md:p-12 rounded-2xl shadow-3xl ${getBackgroundColor(result.healthScore)} relative`}
                  initial={{ y: 50, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.8, type: 'spring', stiffness: 90 }}
                >
                  <div className="text-center mb-6">
                    <h2 className="text-3xl sm:text-4xl font-semibold inline-block gradient-text drop-shadow">
                      {result.healthScore === 'Healthy' ? `${result.healthScore} 🥗` : 
                       result.healthScore === 'Moderately Healthy' ? `${result.healthScore} 🍎` : 
                       `${result.healthScore} 🍔`}
                    </h2>
                  </div>
                  <div className={`h-4 rounded-full ${getHealthScoreColor(result.healthScore)} mb-6 pulse-glow`}></div>
                  <p className="mb-4 text-lg text-gray-800"><strong>Reason:</strong> {result.reason}</p>
                  <p className="mb-4 text-lg text-gray-800"><strong>Warnings:</strong> <span className="text-red-500 font-bold"> {result.warnings.join(', ')} 😱</span></p>
                  <p className="mb-4 text-lg text-gray-800"><strong>Allergens:</strong> <span className="text-red-500 font-bold"> {result.allergens.join(', ') || 'None detected'} 😱</span></p>
                  <p className="mb-4 text-lg text-gray-800"><strong>Disease Risk:</strong> <span className="text-red-500 font-bold"> {result.diseaseRisk.join(', ')} 😱</span></p>
                  <p className="mb-4 text-lg text-gray-800"><strong>Suggestions:</strong> {result.suggestions.join(', ')}</p>
                  <p className="text-xl text-gray-800 italic mt-6 text-center drop-shadow">
                    Fun Fact: This item has more {result.warnings[0]?.toLowerCase() || 'sugar'} than a pack of fries! 📊
                  </p>
                  {result.healthScore === 'Healthy' && (
                    <>
                      <img src="/tenor.gif" alt="Tenor GIF" className="gif-float tenor" style={{ bottom: '8px', left: '8px' }} />
                      <img src="/source.gif" alt="Source GIF" className="gif-float source" style={{ bottom: '8px', right: '8px' }} />
                    </>
                  )}
                  {result.healthScore === 'Unhealthy' && (
                    <>
                      <img src="/liver.gif" alt="Liver GIF" className="gif-float drink" style={{ bottom: '8px', left: '8px' }} />
                      <img src="/liver.gif" alt="Liver GIF" className="gif-float liver" style={{ bottom: '8px', right: '8px' }} />
                    </>
                  )}
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* BiteWise Health Dashboard */}
          <motion.div
            className="glassmorphic p-8 sm:p-10 md:p-12 rounded-2xl shadow-3xl"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8, type: 'spring', stiffness: 90 }}
          >
            <h2 className="text-4xl sm:text-5xl font-extrabold mb-6 gradient-text drop-shadow-lg">BiteWise Health Dashboard 📊</h2>
            <div className="space-y-4">
              {history.slice(0, 5).map((item, index) => (
                <motion.div
                  key={index}
                  className="flex justify-between p-4 glassmorphic rounded-lg shadow-lg"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <span className="text-lg font-medium gradient-text">{item.healthScore}</span>
                  <span className="text-sm text-gray-900">{new Date(item.timestamp).toLocaleDateString()}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Health GIF Section (Emblem) */}
          <div
            className="w-full h-screen flex flex-col justify-center items-center bg-no-repeat bg-cover"
            style={{
              backgroundImage: "url('/bg-gradient.png')" // rename your image if needed
            }}
          >
            {/* Bouncy & twisty GIF */}
            <motion.img
              src="/health.gif"
              alt="Health Emblem"
              className="w-[600px] h-[220px] object-cover rounded-2xl shadow-[0_0_40px_#22d3ee] hover:shadow-[0_0_60px_#06b6d4] transition-shadow duration-500"
              animate={{
                scale: [1, 1.05, 1],
                rotate: [0, 2, -2, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                repeatType: "loop",
                ease: "easeInOut"
              }}
            />

            {/* Text below the GIF */}
            <motion.p
              className="mt-6 text-2xl font-semibold text-white drop-shadow-lg"
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5, duration: 1 }}
            >
              Eating us makes you healthy
            </motion.p>
          </div>
        </div>
      </div>
    </>
  );
};

export default App;