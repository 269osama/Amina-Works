import React, { useRef, useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

interface VideoPlayerProps {
  mediaUrl: string | null;
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  onDurationChange: (duration: number) => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  volume: number; // 0 to 1
  isMuted: boolean;
  dubAudioUrl?: string | null; // URL for the generated dub audio
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  mediaUrl,
  currentTime,
  onTimeUpdate,
  onDurationChange,
  isPlaying,
  setIsPlaying,
  volume,
  isMuted,
  dubAudioUrl
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const isSeekingRef = useRef(false);
  
  // State to toggle between original and dub if dub is available
  const [useDub, setUseDub] = useState(false);

  // Automatically enable dub mode if a new dub URL arrives
  useEffect(() => {
    if (dubAudioUrl) {
      setUseDub(true);
    } else {
      setUseDub(false);
    }
  }, [dubAudioUrl]);

  // Sync Play/Pause
  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video) return;

    if (isPlaying) {
      if (video.paused) video.play().catch(e => console.error("Video play error", e));
      if (useDub && audio && audio.paused) audio.play().catch(e => console.error("Audio play error", e));
    } else {
      if (!video.paused) video.pause();
      if (audio && !audio.paused) audio.pause();
    }
  }, [isPlaying, useDub]);

  // Sync Volume & Mute logic
  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video) return;

    if (useDub && audio) {
        // Mute video, play audio with volume
        video.muted = true;
        audio.volume = volume;
        audio.muted = isMuted;
    } else {
        // Standard video playback
        video.volume = volume;
        video.muted = isMuted;
        if (audio) audio.muted = true; // Silence the dub track if present but not active
    }
  }, [volume, isMuted, useDub]);

  // Sync external time changes to video (seeking)
  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video || isSeekingRef.current) return;

    // Only seek if the difference is significant
    if (Math.abs(video.currentTime - currentTime) > 0.2) {
      video.currentTime = currentTime;
      if (audio) audio.currentTime = currentTime;
    }
  }, [currentTime]);

  // If using dub, we need to ensure audio stays synced with video during playback events
  const handleTimeUpdate = (time: number) => {
     if (!isSeekingRef.current) {
        onTimeUpdate(time);
        
        // Minor correction if audio drifts
        const video = videoRef.current;
        const audio = audioRef.current;
        if (useDub && video && audio && !audio.paused && Math.abs(audio.currentTime - video.currentTime) > 0.3) {
            audio.currentTime = video.currentTime;
        }
     }
  };

  if (!mediaUrl) {
    return (
      <div className="w-full h-full bg-zinc-950 flex flex-col items-center justify-center text-zinc-500 border-b border-zinc-800">
        <div className="w-24 h-24 rounded-full bg-zinc-900 flex items-center justify-center mb-4 shadow-inner">
          <svg className="w-10 h-10 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>
        <p className="font-medium">No Media Loaded</p>
        <p className="text-sm opacity-50 mt-1">Import a video or audio file to begin</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-black relative group flex items-center justify-center overflow-hidden">
      <video
        ref={videoRef}
        src={mediaUrl}
        className="max-w-full max-h-full shadow-2xl"
        onTimeUpdate={(e) => handleTimeUpdate(e.currentTarget.currentTime)}
        onDurationChange={(e) => onDurationChange(e.currentTarget.duration)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onSeeking={() => { 
            isSeekingRef.current = true; 
            if (audioRef.current) audioRef.current.currentTime = videoRef.current?.currentTime || 0;
        }}
        onSeeked={() => { isSeekingRef.current = false; }}
        playsInline
      />
      
      {/* Hidden Audio Player for Dubbing */}
      {dubAudioUrl && (
          <audio 
             ref={audioRef}
             src={dubAudioUrl}
             preload="auto"
          />
      )}

      {/* Dubbing Toggle UI */}
      {dubAudioUrl && (
          <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md border border-white/10 rounded-full p-1 flex items-center gap-1 z-30 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                  onClick={() => setUseDub(false)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${!useDub ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'}`}
              >
                  Original
              </button>
              <button
                  onClick={() => setUseDub(true)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${useDub ? 'bg-indigo-500 text-white' : 'text-zinc-400 hover:text-white'}`}
              >
                  AI Dub
              </button>
          </div>
      )}
    </div>
  );
};

export default VideoPlayer;