import React, { useState, useEffect, useCallback } from 'react';
import { Subtitle, ProcessingStatus, LANGUAGES, User } from './types';
import { generateSRT, downloadFile, fileToBase64, processMediaForGemini } from './utils';
import { generateSubtitlesFromMedia, translateSubtitlesWithGemini } from './services/geminiService';
import { mockBackend } from './services/mockBackend';
import VideoPlayer from './components/VideoPlayer';
import SubtitleEditor from './components/SubtitleEditor';
import Timeline from './components/Timeline';
import AuthScreen from './components/AuthScreen';
import AdminDashboard from './components/AdminDashboard';
import AdminPortal from './components/AdminPortal';
import GoogleDrivePicker from './components/GoogleDrivePicker';
import { 
  Sparkles, 
  Upload, 
  Download, 
  Play, 
  Pause, 
  Globe, 
  Film,
  Volume2,
  VolumeX,
  Undo,
  Redo,
  ZoomIn,
  ZoomOut,
  X,
  ArrowRightLeft,
  LogOut,
  Shield,
  Save,
  LayoutGrid,
  HardDrive
} from 'lucide-react';

// Routing State
type ViewMode = 'auth' | 'admin-portal' | 'admin-dashboard' | 'workspace';

const App: React.FC = () => {
  // --- User / View State ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('auth');
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // --- App State ---
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  
  // History for Undo/Redo
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [history, setHistory] = useState<Subtitle[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [statusMessage, setStatusMessage] = useState("");
  const [selectedLang, setSelectedLang] = useState('es');
  const [zoomLevel, setZoomLevel] = useState(50); // Pixels per second
  const [isSyncMenuOpen, setIsSyncMenuOpen] = useState(false);

  // Drive State
  const [isDrivePickerOpen, setIsDrivePickerOpen] = useState(false);
  const [driveMode, setDriveMode] = useState<'import' | 'export'>('import');

  // --- Auth Lifecycle ---
  useEffect(() => {
    // Check persistent storage on load
    const user = mockBackend.getCurrentUser();
    if (user) {
      handleLoginSuccess(user);
    } else {
      setViewMode('auth');
    }
    setIsCheckingAuth(false);
  }, []);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    
    if (user.role === 'admin') {
      setViewMode('admin-portal');
    } else {
      setViewMode('workspace');
      loadUserData(user.id);
    }
  };

  const loadUserData = (userId: string) => {
    // Load previous work from persistent storage
    mockBackend.loadUserWork(userId).then(data => {
      if (data) {
        setSubtitles(data.subtitles);
        setHistory([data.subtitles]);
        setHistoryIndex(0);
        if (data.mediaName) {
            setStatusMessage(`Restored project for: ${data.mediaName}. Please re-upload video to play.`);
        }
      }
    });
  };

  // Auto-save logic
  const saveWork = async (newSubtitles: Subtitle[]) => {
    if (currentUser) {
      await mockBackend.saveUserWork(currentUser.id, newSubtitles, mediaFile?.name);
    }
  };

  // --- History Management ---
  const pushToHistory = useCallback((newSubtitles: Subtitle[]) => {
    if (historyIndex >= 0 && JSON.stringify(history[historyIndex]) === JSON.stringify(newSubtitles)) {
      return;
    }

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newSubtitles);
    
    if (newHistory.length > 50) newHistory.shift();
    
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setSubtitles(newSubtitles);
    
    // Trigger Auto-Save
    saveWork(newSubtitles);

  }, [history, historyIndex, currentUser, mediaFile]);

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setSubtitles(history[newIndex]);
      saveWork(history[newIndex]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setSubtitles(history[newIndex]);
      saveWork(history[newIndex]);
    }
  };

  const commitChanges = () => {
    pushToHistory([...subtitles]);
  };

  // --- Actions ---

  const handleLogout = () => {
    mockBackend.logout();
    setCurrentUser(null);
    setMediaFile(null);
    setMediaUrl(null);
    setSubtitles([]);
    setViewMode('auth');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setMediaFile(file);
      setMediaUrl(URL.createObjectURL(file));
      
      // Only reset if we have no subtitles
      if (subtitles.length === 0) {
        const initialSubs: Subtitle[] = [];
        setSubtitles(initialSubs);
        setHistory([initialSubs]);
        setHistoryIndex(0);
      }
      
      setStatus(ProcessingStatus.READY);
      setCurrentTime(0);
      setIsPlaying(false);
    }
  };

  const handleResetProject = () => {
    if (confirm("Are you sure you want to close this project? Unsaved changes will be lost.")) {
      setMediaFile(null);
      setMediaUrl(null);
      setSubtitles([]);
      setHistory([]);
      setHistoryIndex(-1);
      setStatus(ProcessingStatus.IDLE);
      setIsPlaying(false);
    }
  };

  const handleGenerate = async () => {
    if (!mediaFile) return;
    setIsPlaying(false);
    setStatus(ProcessingStatus.UPLOADING);
    setStatusMessage("Processing media...");

    try {
      setStatus(ProcessingStatus.ANALYZING);
      const generatedSubs = await generateSubtitlesFromMedia(mediaFile, setStatusMessage);
      pushToHistory(generatedSubs);
      setStatus(ProcessingStatus.IDLE);
    } catch (error: any) {
      console.error(error);
      setStatus(ProcessingStatus.ERROR);
      setStatusMessage(error.message || "An error occurred");
    }
  };

  const handleTranslate = async () => {
    if (subtitles.length === 0) return;
    setStatus(ProcessingStatus.TRANSLATING);
    setStatusMessage(`Translating subtitles to ${LANGUAGES.find(l => l.code === selectedLang)?.name}...`);

    try {
      const translatedSubs = await translateSubtitlesWithGemini(subtitles, selectedLang);
      pushToHistory(translatedSubs);
      setStatus(ProcessingStatus.IDLE);
    } catch (error: any) {
      setStatus(ProcessingStatus.ERROR);
      setStatusMessage(error.message || "Translation failed");
    }
  };

  const handleSyncOffset = (offsetMs: number) => {
    const offsetSeconds = offsetMs / 1000;
    const newSubs = subtitles.map(sub => ({
      ...sub,
      startTime: Math.max(0, parseFloat((sub.startTime + offsetSeconds).toFixed(3))),
      endTime: Math.max(0, parseFloat((sub.endTime + offsetSeconds).toFixed(3)))
    }));
    pushToHistory(newSubs);
  };

  const handleExport = (format: 'srt' | 'json') => {
    if (format === 'srt') {
      const content = generateSRT(subtitles);
      downloadFile(content, 'subtitles.srt', 'text/plain');
    } else {
      const content = JSON.stringify(subtitles, null, 2);
      downloadFile(content, 'subtitles.json', 'application/json');
    }
  };

  // --- Drive Actions ---
  const openDriveImport = () => {
      setDriveMode('import');
      setIsDrivePickerOpen(true);
  };
  
  const openDriveExport = () => {
      setDriveMode('export');
      setIsDrivePickerOpen(true);
  };

  const handleDriveConnect = async () => {
      if (currentUser) {
          await mockBackend.updateUserDriveStatus(currentUser.id, true);
          setCurrentUser({...currentUser, googleDriveConnected: true});
      }
  };

  const handleDriveSelect = async (url: string, name: string) => {
      setMediaUrl(url);
      setMediaFile(new File([], name)); // Mock file object for name display
      setStatus(ProcessingStatus.READY);
      // If we import a new video, we might want to keep existing subs or clear them. 
      // For now, let's keep them if they exist, assuming re-linking.
  };

  const activeSubtitleId = subtitles.find(
    s => currentTime >= s.startTime && currentTime <= s.endTime
  )?.id || null;

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying(prev => !prev);
      }
      if (e.code === 'ArrowLeft') {
        setCurrentTime(prev => Math.max(0, prev - 2));
      }
      if (e.code === 'ArrowRight') {
        setCurrentTime(prev => Math.min(duration, prev + 2));
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [duration, historyIndex, history]); 

  // --- Render Views ---

  if (isCheckingAuth) {
    return <div className="h-screen w-screen bg-black flex items-center justify-center text-zinc-600 font-serif italic">Loading Amina's Work App...</div>;
  }

  // 1. Auth Screen
  if (!currentUser || viewMode === 'auth') {
    return <AuthScreen onLoginSuccess={handleLoginSuccess} />;
  }

  // 2. Admin Portal Landing
  if (viewMode === 'admin-portal' && currentUser.role === 'admin') {
    return (
      <AdminPortal 
        user={currentUser}
        onSelect={(dest) => {
           if (dest === 'workspace') {
             setViewMode('workspace');
             // Ensure data is loaded
             loadUserData(currentUser.id);
           } else {
             setViewMode('admin-dashboard');
           }
        }}
        onLogout={handleLogout}
      />
    );
  }

  // 3. Admin Dashboard
  if (viewMode === 'admin-dashboard' && currentUser.role === 'admin') {
    return <AdminDashboard onClose={() => setViewMode('admin-portal')} />;
  }

  // 4. Main Workspace (User & Admin)
  return (
    <div className="h-screen w-screen flex flex-col bg-black text-zinc-100 font-sans overflow-hidden selection:bg-amber-500/30 selection:text-amber-100">
      
      <GoogleDrivePicker 
         isOpen={isDrivePickerOpen} 
         onClose={() => setIsDrivePickerOpen(false)}
         mode={driveMode}
         isConnected={!!currentUser.googleDriveConnected}
         onConnect={handleDriveConnect}
         onSelectFile={handleDriveSelect}
         onExport={() => setStatusMessage("Saved to Google Drive successfully.")}
      />

      {/* --- Top Bar --- */}
      <header className="h-16 border-b border-zinc-900 bg-zinc-950 flex items-center justify-between px-4 shrink-0 z-50 shadow-lg">
        
        {/* Left: Branding & File Ops */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
             <div className="relative w-8 h-8 flex items-center justify-center bg-gradient-to-b from-zinc-800 to-black rounded-lg border border-zinc-800 shadow-inner">
               <span className="font-serif text-lg text-amber-500 font-bold">A</span>
             </div>
             <div className="flex flex-col justify-center">
                <span className="font-serif font-bold text-sm tracking-wide text-zinc-100">Amina's Work</span>
                <span className="text-[9px] text-zinc-500 uppercase tracking-widest">Intelligence Suite</span>
             </div>
          </div>

          <div className="h-6 w-px bg-zinc-900 mx-1"></div>

          {!mediaUrl ? (
             <div className="flex items-center gap-2">
                <label className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-zinc-100 hover:bg-white text-black rounded-md text-xs font-semibold transition-all shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                  <Upload size={14} />
                  Import Media
                  <input type="file" className="hidden" accept="video/*,audio/*" onChange={handleFileUpload} />
                </label>
                
                <button 
                  onClick={openDriveImport}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-md text-xs font-medium transition-all border border-zinc-800 hover:border-zinc-700"
                >
                  <HardDrive size={14} />
                  Drive
                </button>

                {subtitles.length > 0 && (
                   <span className="text-xs text-amber-500 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20 animate-pulse">
                     Session Restored
                   </span>
                )}
             </div>
          ) : (
             <div className="flex items-center gap-2 bg-zinc-900/50 pr-1 rounded-md border border-zinc-800">
                <span className="text-xs text-zinc-300 px-3 py-1.5 max-w-[150px] truncate border-r border-zinc-800">
                  {mediaFile?.name || "Imported Media"}
                </span>
                <button 
                  onClick={handleResetProject}
                  className="p-1.5 m-0.5 hover:bg-red-900/20 text-zinc-500 hover:text-red-400 rounded transition-colors"
                  title="Close Project"
                >
                  <X size={14} />
                </button>
             </div>
          )}
        </div>

        {/* Center: Playback Controls */}
        <div className="flex items-center gap-4 absolute left-1/2 -translate-x-1/2">
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            disabled={!mediaUrl}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-amber-500/90 text-black hover:bg-amber-400 hover:scale-105 transition-all disabled:opacity-20 disabled:bg-zinc-700 disabled:hover:scale-100 shadow-[0_0_20px_rgba(245,158,11,0.3)]"
          >
            {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
          </button>
          
          <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 w-32 justify-center">
            <span className="text-zinc-300">{new Date(currentTime * 1000).toISOString().substr(14, 5)}</span>
            <span className="opacity-30">/</span>
            <span>{new Date(duration * 1000).toISOString().substr(14, 5)}</span>
          </div>
        </div>

        {/* Right: User & Tools */}
        <div className="flex items-center gap-3">
           {status !== ProcessingStatus.IDLE && status !== ProcessingStatus.READY && status !== ProcessingStatus.ERROR && (
             <div className="hidden md:flex items-center gap-2 text-xs text-amber-400 animate-pulse mr-2 bg-amber-500/5 px-2 py-1 rounded border border-amber-500/10">
                <Sparkles size={12} />
                <span>{statusMessage}</span>
             </div>
           )}

           {/* Editor Tools Group */}
           {(subtitles.length > 0 || mediaUrl) && (
             <div className="flex items-center gap-2 mr-2">
                {mediaUrl && subtitles.length === 0 && status !== ProcessingStatus.ANALYZING && status !== ProcessingStatus.UPLOADING && (
                    <button
                        onClick={handleGenerate}
                        className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-md text-xs font-semibold transition-all shadow-lg shadow-indigo-900/20 hover:-translate-y-0.5"
                    >
                        <Sparkles size={14} />
                        Auto-Generate
                    </button>
                )}

                {subtitles.length > 0 && (
                    <>
                        {/* Sync Menu */}
                        <div className="relative">
                            <button 
                                onClick={() => setIsSyncMenuOpen(!isSyncMenuOpen)}
                                className={`flex items-center gap-2 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-md text-xs font-medium transition-colors border ${isSyncMenuOpen ? 'border-amber-500' : 'border-zinc-800'}`}
                            >
                                <ArrowRightLeft size={14} />
                                Sync
                            </button>
                            {isSyncMenuOpen && (
                                <div className="absolute top-full right-0 mt-2 w-48 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl p-3 z-50 flex flex-col gap-2">
                                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Global Offset</div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button onClick={() => handleSyncOffset(-100)} className="px-2 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs text-zinc-300 border border-zinc-700/50">-100ms</button>
                                        <button onClick={() => handleSyncOffset(100)} className="px-2 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs text-zinc-300 border border-zinc-700/50">+100ms</button>
                                        <button onClick={() => handleSyncOffset(-500)} className="px-2 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs text-zinc-300 border border-zinc-700/50">-500ms</button>
                                        <button onClick={() => handleSyncOffset(500)} className="px-2 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs text-zinc-300 border border-zinc-700/50">+500ms</button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Translate & Export */}
                        <div className="flex items-center bg-zinc-900 rounded-md border border-zinc-800 overflow-hidden">
                            <div className="relative">
                                <select 
                                    className="bg-transparent text-xs text-zinc-300 outline-none pl-2 pr-6 py-1.5 cursor-pointer hover:bg-zinc-800 appearance-none z-10 relative"
                                    value={selectedLang}
                                    onChange={(e) => setSelectedLang(e.target.value)}
                                >
                                    {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                                </select>
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                                    <Globe size={10} />
                                </div>
                            </div>
                            <button 
                                onClick={handleTranslate}
                                className="px-2 py-1.5 border-l border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-indigo-400 transition-colors"
                                title="Translate Subtitles"
                            >
                                <Globe size={14} />
                            </button>
                        </div>
                        
                        <div className="flex items-center bg-zinc-900 rounded-md border border-zinc-800 overflow-hidden">
                             <button 
                                onClick={() => handleExport('srt')}
                                className="px-3 py-1.5 hover:bg-zinc-800 text-zinc-300 text-xs font-medium transition-colors border-r border-zinc-800"
                            >
                                <Download size={14} className="inline mr-1" />
                                Export
                            </button>
                            <button 
                                onClick={openDriveExport}
                                className="px-2 py-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-blue-400 transition-colors"
                                title="Save to Google Drive"
                            >
                                <HardDrive size={14} />
                            </button>
                        </div>
                    </>
                )}
             </div>
           )}

           {/* User Menu */}
           <div className="h-6 w-px bg-zinc-900 mx-1"></div>
           <div className="flex items-center gap-3 pl-2">
              <div className="flex flex-col items-end">
                 <span className="text-xs font-medium text-zinc-200 font-serif italic">{currentUser.name}</span>
              </div>
              
              {currentUser.role === 'admin' && (
                 <button 
                   onClick={() => setViewMode('admin-portal')}
                   className="p-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-amber-500/70 hover:text-amber-400 rounded-full transition-colors shadow-sm"
                   title="Back to Portal"
                 >
                   <LayoutGrid size={16} />
                 </button>
              )}
              
              <button 
                onClick={handleLogout}
                className="p-2 hover:bg-zinc-800 text-zinc-500 hover:text-white rounded-full transition-colors"
                title="Log Out"
              >
                <LogOut size={16} />
              </button>
           </div>
        </div>
      </header>

      {/* --- Main Workspace --- */}
      <main className="flex-1 flex overflow-hidden">
        
        {/* Left: Player & Timeline */}
        <div className="flex-1 flex flex-col min-w-0 bg-black relative">
          
          {/* Video Viewport */}
          <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
            <VideoPlayer 
              mediaUrl={mediaUrl}
              currentTime={currentTime}
              onTimeUpdate={setCurrentTime}
              onDurationChange={setDuration}
              isPlaying={isPlaying}
              setIsPlaying={setIsPlaying}
              volume={volume}
              isMuted={isMuted}
            />
            
            {/* Subtitle Overlay */}
            {activeSubtitleId && mediaUrl && (
              <div className="absolute bottom-[10%] left-0 right-0 text-center pointer-events-none px-8 z-20">
                <span className="bg-black/70 text-white px-4 py-2 text-xl rounded shadow-xl inline-block backdrop-blur-md whitespace-pre-wrap">
                  {subtitles.find(s => s.id === activeSubtitleId)?.text}
                </span>
              </div>
            )}
          </div>

          {/* Mini Toolbar */}
          <div className="h-12 bg-zinc-950 border-t border-zinc-900 flex items-center justify-between px-4 shrink-0 select-none z-10">
             <div className="flex items-center gap-6">
                {/* Volume */}
                <div className="flex items-center gap-2 group">
                   <button onClick={() => setIsMuted(!isMuted)} className="text-zinc-500 hover:text-white transition-colors">
                      {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                   </button>
                   <div className="w-24 h-6 flex items-center">
                    <input 
                        type="range" 
                        min="0" 
                        max="1" 
                        step="0.05" 
                        value={isMuted ? 0 : volume}
                        onChange={(e) => {
                          setVolume(parseFloat(e.target.value));
                          if (parseFloat(e.target.value) > 0) setIsMuted(false);
                        }}
                        className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500 hover:accent-amber-400"
                    />
                   </div>
                </div>

                <div className="h-4 w-px bg-zinc-900"></div>

                {/* Undo/Redo */}
                <div className="flex items-center gap-1">
                   <button 
                     onClick={handleUndo} 
                     disabled={historyIndex <= 0}
                     className="p-1.5 rounded text-zinc-500 hover:text-white hover:bg-zinc-900 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-600 transition-colors"
                     title="Undo (Ctrl+Z)"
                   >
                     <Undo size={16} />
                   </button>
                   <button 
                     onClick={handleRedo} 
                     disabled={historyIndex >= history.length - 1}
                     className="p-1.5 rounded text-zinc-500 hover:text-white hover:bg-zinc-900 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-600 transition-colors"
                     title="Redo (Ctrl+Y)"
                   >
                     <Redo size={16} />
                   </button>
                </div>
             </div>

             {/* Zoom Controls */}
             <div className="flex items-center gap-3">
                <ZoomOut size={14} className="text-zinc-600" />
                <input 
                   type="range" 
                   min="10" 
                   max="200" 
                   value={zoomLevel} 
                   onChange={(e) => setZoomLevel(parseInt(e.target.value))}
                   className="w-32 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-500 hover:accent-zinc-400" 
                />
                <ZoomIn size={14} className="text-zinc-600" />
             </div>
          </div>

          {/* Timeline */}
          <Timeline 
            duration={duration} 
            currentTime={currentTime} 
            subtitles={subtitles} 
            onSeek={setCurrentTime}
            zoomLevel={zoomLevel}
          />
        </div>

        {/* Right: Subtitle Editor Sidebar */}
        <div className="w-[400px] shrink-0 border-l border-zinc-900 flex flex-col bg-zinc-950 shadow-xl z-10">
           <SubtitleEditor 
             subtitles={subtitles}
             currentTime={currentTime}
             activeSubtitleId={activeSubtitleId}
             onSeek={(t) => setCurrentTime(t)}
             onUpdateSubtitle={(id, updates) => {
               setSubtitles(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
             }}
             onCommitChanges={commitChanges}
             onDeleteSubtitle={(id) => {
               const newSubs = subtitles.filter(s => s.id !== id);
               setSubtitles(newSubs); 
               pushToHistory(newSubs); 
             }}
           />
        </div>

      </main>
    </div>
  );
};

export default App;