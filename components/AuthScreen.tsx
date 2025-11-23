import React, { useState, useRef } from 'react';
import { ArrowRight, User as UserIcon, Lock, Loader2, Sparkles, Eye, EyeOff } from 'lucide-react';
import { mockBackend } from '../services/mockBackend';
import { User } from '../types';

interface AuthScreenProps {
  onLoginSuccess: (user: User) => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  
  const [identifier, setIdentifier] = useState(""); // Email or Username
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");

  const cardRef = useRef<HTMLDivElement>(null);

  // 3D Tilt Effect Logic
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const card = cardRef.current;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const rotateX = ((y - centerY) / centerY) * -5; // Max -5 to 5 degrees
    const rotateY = ((x - centerX) / centerX) * 5;

    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.01, 1.01, 1.01)`;
  };

  const handleMouseLeave = () => {
    if (!cardRef.current) return;
    cardRef.current.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      let user: User;
      if (isLogin) {
        user = await mockBackend.login(identifier, password);
      } else {
        if (!name) throw new Error("Name is required");
        user = await mockBackend.signup(identifier, password, name);
      }
      
      onLoginSuccess(user);
      
    } catch (err: any) {
      setError(err.message || "Authentication failed");
      
      // Security: Clear password on failure to allow fresh retry
      setPassword("");
      
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-black flex flex-col items-center justify-center relative overflow-hidden font-sans text-zinc-100 selection:bg-amber-500/30 selection:text-amber-200">
      
      {/* Ambient Background Lights */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-amber-600/10 rounded-full blur-[128px] animate-pulse" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-indigo-900/20 rounded-full blur-[128px]" />
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>

      {/* 3D Container */}
      <div 
        className="relative z-10 p-10"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div 
          ref={cardRef}
          className="w-[420px] bg-zinc-950/40 backdrop-blur-2xl border border-zinc-800/50 rounded-2xl shadow-[0_0_40px_-10px_rgba(0,0,0,0.7)] p-8 relative transition-transform duration-200 ease-out group"
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* Card Glow Border Effect */}
          <div className="absolute inset-0 rounded-2xl border border-white/5 pointer-events-none"></div>
          <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-b from-white/10 to-transparent opacity-20 pointer-events-none"></div>

          {/* Header */}
          <div className="flex flex-col items-center mb-10 transform translate-z-10">
            <div className="mb-6 relative">
              <div className="absolute inset-0 bg-amber-500 blur-xl opacity-20 rounded-full"></div>
              <div className="relative w-16 h-16 bg-gradient-to-tr from-zinc-900 to-black border border-amber-500/30 rounded-full flex items-center justify-center shadow-2xl shadow-amber-900/20">
                 <span className="font-serif text-3xl italic text-amber-100">A</span>
              </div>
            </div>
            <h1 className="font-serif text-3xl tracking-wide text-transparent bg-clip-text bg-gradient-to-b from-amber-100 via-amber-200 to-amber-600/80">
              Amina's Work
            </h1>
            <p className="text-zinc-500 text-xs uppercase tracking-[0.2em] mt-2 font-medium">Elite Intelligence Suite</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6 relative z-20">
            
            {!isLogin && (
              <div className="relative group/input">
                <input 
                  type="text" 
                  id="name"
                  required 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block px-2.5 pb-2.5 pt-4 w-full text-sm text-zinc-100 bg-zinc-900/50 rounded-lg border border-zinc-700 appearance-none focus:outline-none focus:ring-0 focus:border-amber-500 peer"
                  placeholder=" "
                />
                <label 
                  htmlFor="name" 
                  className="absolute text-sm text-zinc-500 duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-transparent px-2 peer-focus:px-2 peer-focus:text-amber-500 peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 left-1 backdrop-blur-sm rounded pointer-events-none"
                >
                  Full Name
                </label>
                <UserIcon size={16} className="absolute right-3 top-3.5 text-zinc-600 peer-focus:text-amber-500/50 transition-colors pointer-events-none" />
              </div>
            )}

            <div className="relative group/input">
              <input 
                type="text" 
                id="identifier"
                required 
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="block px-2.5 pb-2.5 pt-4 w-full text-sm text-zinc-100 bg-zinc-900/50 rounded-lg border border-zinc-700 appearance-none focus:outline-none focus:ring-0 focus:border-amber-500 peer"
                placeholder=" "
              />
              <label 
                htmlFor="identifier" 
                className="absolute text-sm text-zinc-500 duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-transparent px-2 peer-focus:px-2 peer-focus:text-amber-500 peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 left-1 backdrop-blur-sm rounded pointer-events-none"
              >
                {isLogin ? "Username or Email" : "Email Address"}
              </label>
              <Sparkles size={16} className="absolute right-3 top-3.5 text-zinc-600 peer-focus:text-amber-500/50 transition-colors pointer-events-none" />
            </div>

            <div className="relative group/input">
              <input 
                type={showPassword ? "text" : "password"}
                id="password"
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block px-2.5 pb-2.5 pt-4 w-full text-sm text-zinc-100 bg-zinc-900/50 rounded-lg border border-zinc-700 appearance-none focus:outline-none focus:ring-0 focus:border-amber-500 peer pr-10"
                placeholder=" "
              />
              <label 
                htmlFor="password" 
                className="absolute text-sm text-zinc-500 duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-transparent px-2 peer-focus:px-2 peer-focus:text-amber-500 peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 left-1 backdrop-blur-sm rounded pointer-events-none"
              >
                Password
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3.5 text-zinc-600 hover:text-zinc-400 transition-colors focus:outline-none"
                tabIndex={-1}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {error && (
              <div className="p-3 bg-red-900/10 border border-red-900/30 rounded-lg text-red-400 text-xs text-center font-medium animate-shake">
                {error}
              </div>
            )}

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full group relative overflow-hidden bg-white text-black py-3.5 rounded-lg font-semibold text-sm transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_-5px_rgba(255,255,255,0.4)]"
            >
              <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-amber-200 via-amber-100 to-amber-200 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <span className="relative z-10 flex items-center justify-center gap-2">
                {isLoading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <>
                    {isLogin ? 'ENTER WORKSPACE' : 'INITIALIZE ACCOUNT'}
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </span>
            </button>
          </form>

          {/* Footer Toggle */}
          <div className="mt-8 text-center">
            <button 
              onClick={() => { setIsLogin(!isLogin); setError(""); setPassword(""); }}
              className="text-xs text-zinc-500 hover:text-amber-200 transition-colors tracking-wide"
            >
              {isLogin ? "NEW USER? APPLY FOR ACCESS" : "ALREADY REGISTERED? SIGN IN"}
            </button>
          </div>

          {/* Decorative Corners */}
          <div className="absolute top-4 left-4 w-2 h-2 border-t border-l border-zinc-700 rounded-tl opacity-50"></div>
          <div className="absolute top-4 right-4 w-2 h-2 border-t border-r border-zinc-700 rounded-tr opacity-50"></div>
          <div className="absolute bottom-4 left-4 w-2 h-2 border-b border-l border-zinc-700 rounded-bl opacity-50"></div>
          <div className="absolute bottom-4 right-4 w-2 h-2 border-b border-r border-zinc-700 rounded-br opacity-50"></div>

        </div>
        
        <div className="text-center mt-8 opacity-30">
           <p className="font-serif text-[10px] text-zinc-500 italic">Amina's Work App v2.0 — Private Build</p>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;