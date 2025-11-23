import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Subtitle, ProcessingStatus, LANGUAGES, User, ActivityType } from './types';
import { generateSRT, downloadFile, fileToBase64, processMediaForGemini } from './utils';
import { generateSubtitlesFromMedia, translateSubtitlesWithGemini, generateDubbedAudio } from './services/geminiService';
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
  HardDrive,
  Mic,
  AlertTriangle,
  Loader2
} from 'lucide-react';

// Routing State
type ViewMode = 'auth' | 'admin-portal' | 'admin-dashboard' | 'workspace';

const App: React.FC = () => {
  // --- Auth & View State ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('auth');
  const [showDrivePicker, setShowDrivePicker] = useState(false);
  const [driveMode, setDriveMode] = useState<'import' | 'export'>('import');

  // --- Editor State ---
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaName, setMediaName] = useState<string>("Untitled Project");
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [activeSubtitleId, setActiveSubtitleId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(20); // px per second
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  
  // --- History (Undo/Redo) ---
  const [history, setHistory] = useState<Subtitle[][]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // --- Dubbing State ---
  const [dubAudioUrl, setDubAudioUrl] = useState<string | null>(null);
  const [dubbingProgress, setDubbingProgress] = useState<number>(0); // 0 to 100

  // --- Initialization ---
  useEffect(() => {
    // Check for existing session
    const user = mockBackend.getCurrentUser();
    if (user) {
      setCurrentUser(user);
      if (user.role === 'admin') {
         setViewMode('admin-portal');
      } else {
         setViewMode('workspace');
         loadUserProject(user.id);
      }
    }
  }, []);

  const loadUserProject = async (userId: string) => {
    const data = await mockBackend.loadUserWork(userId);
    if (data) {
      setSubtitles(data.subtitles);
      setHistory([data.subtitles]);
      setHistoryIndex(0);
      setMediaName(data.mediaName || "Untitled Project");
    }
  };

  // --- Auth Handlers ---
  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    if (user.role === 'admin') {
      setViewMode('admin-portal');
    } else {
      setViewMode('workspace');
      loadUserProject(user.id);
    }
  };

  const handleLogout = () => {
    mockBackend.logout();
    setCurrentUser(null);
    setViewMode('auth');
    setSubtitles([]);
    setMediaUrl(null);
  };

  const logAction = (type: ActivityType, details: any) => {
    if (currentUser) {
      mockBackend.logActivity(currentUser.id, type, details);
    }
  };

  // --- History Handlers ---
  const addToHistory = (newSubtitles: Subtitle[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newSubtitles);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    
    // Auto-save
    if (currentUser) {
      mockBackend.saveUserWork(currentUser.id, newSubtitles, mediaName);
    }
  };

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setSubtitles(history[historyIndex - 1]);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setSubtitles(history[historyIndex + 1]);
    }
  };

  // --- Core Features ---

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset project
    setProcessingStatus(ProcessingStatus.UPLOADING);
    setStatusMessage("Processing media...");
    setSubtitles([]);
    setHistory([]);
    setHistoryIndex(-1);
    setDubAudioUrl(null);

    setMediaName(file.name);
    const url = URL.createObjectURL(file);
    setMediaUrl(url);
    
    // Log upload
    logAction('UPLOAD', { fileName: file.name });

    setProcessingStatus(ProcessingStatus.IDLE);
    setStatusMessage("");
  };

  const handleGenerate = async () => {
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    const file = fileInput?.files?.[0];

    if (!file) {
      alert("Please upload a file first.");
      return;
    }

    setProcessingStatus(ProcessingStatus.ANALYZING);
    setStatusMessage("Initializing Gemini AI...");

    try {
      // Pass the raw File object to the service to use optimized audio extraction
      const { subtitles: generatedSubtitles, detectedLanguage } = await generateSubtitlesFromMedia(
        file, 
        (msg) => setStatusMessage(msg)
      );
      
      setSubtitles(generatedSubtitles);
      addToHistory(generatedSubtitles);
      setProcessingStatus(ProcessingStatus.READY);
      
      logAction('GENERATE', { 
        fileName: mediaName, 
        detectedLanguage, 
        itemCount: generatedSubtitles.length 
      });

    } catch (error) {
      console.error(error);
      setProcessingStatus(ProcessingStatus.ERROR);
      setStatusMessage("Failed to generate subtitles.");
    }
  };

  const handleTranslate = async (targetLang: string) => {
    if (subtitles.length === 0) return;

    setProcessingStatus(ProcessingStatus.TRANSLATING);
    setStatusMessage(`Translating to ${targetLang}...`);

    try {
      const translated = await translateSubtitlesWithGemini(subtitles, targetLang);
      setSubtitles(translated);
      addToHistory(translated);
      setProcessingStatus(ProcessingStatus.READY);
      
      logAction('TRANSLATE', { 
        fileName: mediaName, 
        targetLanguage: targetLang, 
        itemCount: subtitles.length 
      });

    } catch (error) {
      setProcessingStatus(ProcessingStatus.ERROR);
      setStatusMessage("Translation failed.");
    }
  };

  const handleDubbing = async () => {
    if (subtitles.length === 0) return;

    setProcessingStatus(ProcessingStatus.ANALYZING); // Reusing status for dubbing
    setStatusMessage("Preparing text for speech synthesis...");
    setDubbingProgress(0);

    try {
      // Compile full script
      const fullText = subtitles
        .sort((a, b) => a.startTime - b.startTime)
        .map(s => s.text)
        .join(' ');

      if (!fullText.trim()) throw new Error("No text to dub.");

      // Call batch dubbing service
      const audioUrl = await generateDubbedAudio(fullText, (progress) => {
         setDubbingProgress(progress);
         setStatusMessage(`Generating Audio: ${Math.round(progress)}%`);
      });
      
      setDubAudioUrl(audioUrl);
      setProcessingStatus(ProcessingStatus.READY);
      setStatusMessage("AI Dub Ready");
      setDubbingProgress(0);

      logAction('DUB', { fileName: mediaName });

    } catch (error) {
      console.error(error);
      setProcessingStatus(ProcessingStatus.ERROR);
      setStatusMessage("Dubbing failed. " + (error as any).message);
      setDubbingProgress(0);
    }
  };

  const handleSync = (offsetMs: number) => {
     const offsetSec = offsetMs / 1000;
     const newSubtitles = subtitles.map(sub => ({
       ...sub,
       startTime: Math.max(0, sub.startTime + offsetSec),
       endTime: Math.max(0, sub.endTime + offsetSec)
     }));
     setSubtitles(newSubtitles);
     addToHistory(newSubtitles);
  };

  const handleExport = (format: string) => {
    if (subtitles.length === 0) return;
    
    let content = "";
    let mime = "text/plain";
    const filename = mediaName.replace(/\.[^/.]+$/, "") + `_subs.${format}`;

    if (format === 'srt') {
      content = generateSRT(subtitles);
      mime = "text/plain";
    } else if (format === 'json') {
      content = JSON.stringify(subtitles, null, 2);
      mime = "application/json";
    }

    downloadFile(content, filename, mime);
    logAction('EXPORT', { fileName: mediaName, format, itemCount: subtitles.length });
  };

  const handleReset = () => {
    if (window.confirm("Are you sure? This will clear current subtitles.")) {
       setSubtitles([]);
       setHistory([]);
       setHistoryIndex(-1);
       setMediaUrl(null);
       setDubAudioUrl(null);
    }
  };

  // --- Render Views ---

  if (viewMode === 'auth') {
    return <AuthScreen onLoginSuccess={handleLoginSuccess} />;
  }

  if (viewMode === 'admin-portal' && currentUser) {
    return (
      <AdminPortal 
        user={currentUser} 
        onLogout={handleLogout}
        onSelect={(dest) => setViewMode(dest === 'dashboard' ? 'admin-dashboard' : 'workspace')}
      />
    );
  }

  if (viewMode === 'admin-dashboard') {
    return <AdminDashboard onClose={() => setViewMode('admin-portal')} />;
  }

  // --- Workspace View ---
  return (
    <div className="h-screen w-screen flex flex-col bg-black text-zinc-100 font-sans overflow-hidden">
      
      {/* Header / Toolbar */}
      <header className="h-16 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between px-4 shrink-0 z-20 shadow-lg">
        
        {/* Left: Branding & File */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 group cursor-pointer" onClick={() => currentUser?.role === 'admin' && setViewMode('admin-portal')}>
            <div className="w-8 h-8 bg-gradient-to-tr from-amber-600 to-amber-400 rounded-lg flex items-center justify-center text-black font-serif font-bold text-lg shadow-lg shadow-amber-900/20">
              A
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-wide text-zinc-100 font-serif">Amina's Work</h1>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest group-hover:text-amber-500 transition-colors">Studio v2.0</p>
            </div>
          </div>
          
          <div className="h-8 w-px bg-zinc-800 mx-2"></div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-md cursor-pointer transition-all group">
              <Upload size={14} className="text-zinc-400 group-hover:text-amber-400" />
              <span className="text-xs font-medium text-zinc-300">Import Media</span>
              <input type="file" id="file-upload" accept="video/*,audio/*" onChange={handleFileUpload} className="hidden" />
            </label>
            
            <button 
               onClick={() => { setDriveMode('import'); setShowDrivePicker(true); }}
               className="p-1.5 text-zinc-500 hover:text-blue-400 hover:bg-blue-900/10 rounded transition-colors"
               title="Import from Google Drive"
            >
               <HardDrive size={16} />
            </button>

            {mediaName && (
               <span className="text-xs text-zinc-500 max-w-[150px] truncate" title={mediaName}>{mediaName}</span>
            )}
          </div>
        </div>

        {/* Center: Playback & Volume */}
        <div className="flex items-center gap-6 absolute left-1/2 -translate-x-1/2">
           <div className="flex items-center gap-2 bg-zinc-900 p-1 rounded-lg border border-zinc-800">
              <button onClick={() => setIsPlaying(!isPlaying)} className="p-2 hover:bg-zinc-800 rounded text-zinc-300 hover:text-white transition-colors">
                {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
              </button>
              <div className="w-px h-6 bg-zinc-800"></div>
              <div className="flex items-center gap-2 px-2 group relative">
                 <button onClick={() => setIsMuted(!isMuted)} className="text-zinc-400 hover:text-white">
                    {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                 </button>
                 <input 
                   type="range" 
                   min="0" max="1" step="0.05"
                   value={volume}
                   onChange={(e) => setVolume(parseFloat(e.target.value))}
                   className="w-20 accent-indigo-500 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                 />
              </div>
           </div>
           
           <div className="text-xs font-mono text-zinc-500 bg-zinc-950 px-3 py-1.5 rounded border border-zinc-900">
             <span className="text-zinc-300">{new Date(currentTime * 1000).toISOString().substr(11, 8)}</span>
             <span className="opacity-50 mx-1">/</span>
             <span>{new Date(duration * 1000).toISOString().substr(11, 8)}</span>
           </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          
          {/* Status Indicator */}
          {processingStatus !== ProcessingStatus.IDLE && (
            <div className="flex items-center gap-2 px-3 py-1 bg-indigo-500/10 text-indigo-400 rounded-full border border-indigo-500/20 text-xs">
              <Loader2 size={12} className="animate-spin" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Sync Tool */}
          <div className="relative group">
             <button className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors" title="Sync Offset">
                <ArrowRightLeft size={18} />
             </button>
             <div className="absolute top-full right-0 mt-2 w-32 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl p-1 hidden group-hover:block z-50">
                <div className="text-[10px] text-zinc-500 px-2 py-1 uppercase tracking-wider">Nudge Subs</div>
                <button onClick={() => handleSync(-100)} className="w-full text-left px-2 py-1.5 text-xs hover:bg-zinc-800 rounded text-zinc-300">- 0.1s</button>
                <button onClick={() => handleSync(100)} className="w-full text-left px-2 py-1.5 text-xs hover:bg-zinc-800 rounded text-zinc-300">+ 0.1s</button>
                <button onClick={() => handleSync(-500)} className="w-full text-left px-2 py-1.5 text-xs hover:bg-zinc-800 rounded text-zinc-300">- 0.5s</button>
                <button onClick={() => handleSync(500)} className="w-full text-left px-2 py-1.5 text-xs hover:bg-zinc-800 rounded text-zinc-300">+ 0.5s</button>
             </div>
          </div>

          <div className="h-6 w-px bg-zinc-800"></div>

          {/* Primary Tools */}
          <button 
             onClick={handleGenerate}
             disabled={processingStatus !== ProcessingStatus.IDLE && processingStatus !== ProcessingStatus.READY}
             className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-semibold shadow-lg shadow-indigo-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Sparkles size={14} />
            Generate
          </button>

          <div className="relative group">
            <button className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-md text-xs font-medium border border-zinc-700 transition-colors">
              <Globe size={14} />
              Translate
            </button>
            <div className="absolute top-full right-0 mt-2 w-40 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl py-1 hidden group-hover:block z-50 max-h-60 overflow-y-auto custom-scrollbar">
              {LANGUAGES.map(lang => (
                <button 
                  key={lang.code}
                  onClick={() => handleTranslate(lang.name)}
                  className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors flex justify-between"
                >
                  {lang.name}
                  <span className="text-zinc-600 uppercase text-[10px]">{lang.code}</span>
                </button>
              ))}
            </div>
          </div>

          {/* AI Dub Button */}
          <button
             onClick={handleDubbing}
             disabled={processingStatus !== ProcessingStatus.IDLE && processingStatus !== ProcessingStatus.READY}
             className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-md text-xs font-semibold shadow-lg shadow-emerald-900/20 transition-all disabled:opacity-50"
             title="Generate AI Voiceover"
          >
             <Mic size={14} />
             AI Dub
          </button>

          <button 
             onClick={() => handleExport('srt')}
             disabled={subtitles.length === 0}
             className="p-2 text-zinc-400 hover:text-emerald-400 hover:bg-emerald-900/10 rounded transition-colors disabled:opacity-30"
             title="Export SRT"
          >
             <Download size={18} />
          </button>
          
          <button 
             onClick={() => { setDriveMode('export'); setShowDrivePicker(true); }}
             disabled={subtitles.length === 0}
             className="p-2 text-zinc-400 hover:text-blue-400 hover:bg-blue-900/10 rounded transition-colors disabled:opacity-30"
             title="Save to Drive"
          >
             <Save size={18} />
          </button>

          <div className="h-6 w-px bg-zinc-800"></div>

          <button 
            onClick={handleReset}
            className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-900/10 rounded transition-colors"
            title="Reset Project"
          >
            <X size={18} />
          </button>

          {/* Admin Back Link (if applicable) */}
          {currentUser?.role === 'admin' && (
             <button 
               onClick={() => setViewMode('admin-portal')}
               className="ml-2 flex items-center gap-1 text-[10px] font-medium px-2 py-1 bg-amber-500/10 text-amber-500 rounded border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
             >
                <Shield size={10} />
                ADMIN
             </button>
          )}
        </div>
      </header>
      
      {/* Dubbing Progress Bar (Overlay) */}
      {dubbingProgress > 0 && dubbingProgress < 100 && (
         <div className="absolute top-16 left-0 right-0 h-1 bg-zinc-900 z-50">
            <div 
               className="h-full bg-emerald-500 transition-all duration-300 ease-out shadow-[0_0_10px_rgba(16,185,129,0.5)]"
               style={{ width: `${dubbingProgress}%` }}
            />
         </div>
      )}

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Video Area */}
        <div className="flex-1 bg-black relative flex flex-col">
          <div className="flex-1 relative">
             <VideoPlayer 
               mediaUrl={mediaUrl}
               currentTime={currentTime}
               onTimeUpdate={(t) => setCurrentTime(t)}
               onDurationChange={(d) => setDuration(d)}
               isPlaying={isPlaying}
               setIsPlaying={setIsPlaying}
               volume={volume}
               isMuted={isMuted}
               dubAudioUrl={dubAudioUrl}
             />
             
             {/* Subtitle Overlay (Preview) */}
             {mediaUrl && (
               <div className="absolute bottom-12 left-0 right-0 text-center pointer-events-none px-8">
                 {subtitles
                   .filter(s => currentTime >= s.startTime && currentTime <= s.endTime)
                   .map(s => (
                     <div key={s.id} className="inline-block bg-black/60 backdrop-blur-sm text-white px-3 py-1.5 rounded text-lg md:text-xl font-medium shadow-lg mb-2 whitespace-pre-wrap">
                       {s.text}
                     </div>
                   ))}
               </div>
             )}
          </div>

          {/* Timeline */}
          <div className="h-36 shrink-0 bg-zinc-950 border-t border-zinc-800 relative flex flex-col z-10">
             <div className="absolute top-2 right-4 flex gap-1 z-20">
                <button onClick={() => setZoomLevel(Math.max(5, zoomLevel - 5))} className="p-1 bg-zinc-800 rounded text-zinc-400 hover:text-white"><ZoomOut size={12} /></button>
                <button onClick={() => setZoomLevel(Math.min(100, zoomLevel + 5))} className="p-1 bg-zinc-800 rounded text-zinc-400 hover:text-white"><ZoomIn size={12} /></button>
                
                <div className="w-px h-4 bg-zinc-700 mx-1"></div>
                
                <button onClick={undo} disabled={historyIndex <= 0} className="p-1 bg-zinc-800 rounded text-zinc-400 hover:text-white disabled:opacity-30"><Undo size={12} /></button>
                <button onClick={redo} disabled={historyIndex >= history.length - 1} className="p-1 bg-zinc-800 rounded text-zinc-400 hover:text-white disabled:opacity-30"><Redo size={12} /></button>
             </div>
             <Timeline 
               duration={duration} 
               currentTime={currentTime} 
               subtitles={subtitles} 
               onSeek={(t) => {
                 setCurrentTime(t);
                 // If dragging timeline, ensure we pause slightly or update smoothly
               }}
               zoomLevel={zoomLevel}
             />
          </div>
        </div>

        {/* Sidebar Editor */}
        <div className="w-[350px] md:w-[400px] border-l border-zinc-800 bg-zinc-950 flex flex-col shrink-0 z-20 shadow-2xl">
          <SubtitleEditor 
            subtitles={subtitles}
            currentTime={currentTime}
            activeSubtitleId={activeSubtitleId}
            onUpdateSubtitle={(id, updates) => {
              const newSubs = subtitles.map(s => s.id === id ? { ...s, ...updates } : s);
              setSubtitles(newSubs);
              // We defer history add to onCommitChanges
            }}
            onCommitChanges={() => {
               addToHistory(subtitles);
            }}
            onDeleteSubtitle={(id) => {
              const newSubs = subtitles.filter(s => s.id !== id);
              setSubtitles(newSubs);
              addToHistory(newSubs);
            }}
            onSeek={(t) => {
               setCurrentTime(t);
               setIsPlaying(false);
            }}
          />
        </div>
      </div>

      {/* Modals */}
      <GoogleDrivePicker 
         isOpen={showDrivePicker}
         onClose={() => setShowDrivePicker(false)}
         mode={driveMode}
         isConnected={currentUser?.googleDriveConnected || false}
         onConnect={() => {
             if (currentUser) {
                 mockBackend.updateUserDriveStatus(currentUser.id, true);
                 setCurrentUser({ ...currentUser, googleDriveConnected: true });
             }
         }}
         onSelectFile={(url, name) => {
             // Handle Drive Import
             setProcessingStatus(ProcessingStatus.UPLOADING);
             setMediaName(name);
             setMediaUrl(url); // In real app, this would be a proxied URL or downloaded blob
             setSubtitles([]);
             setHistory([]);
             setDubAudioUrl(null);
             
             // Simulate "downloading" delay
             setTimeout(() => {
                 setProcessingStatus(ProcessingStatus.IDLE);
             }, 1000);
         }}
         onExport={() => {
             // Handle Drive Save
             // In a real app, we'd upload the blobs here
             logAction('EXPORT', { fileName: mediaName, format: 'drive-backup' });
         }}
      />
    </div>
  );
};

export default App;