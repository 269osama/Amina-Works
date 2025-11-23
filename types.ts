export interface Subtitle {
  id: string;
  startTime: number; // in seconds
  endTime: number; // in seconds
  text: string;
  originalText?: string; // For translation comparison
  speaker?: string;
  confidence?: number; // 0-1
}

export interface ProjectSettings {
  maxCharsPerLine: number;
  minDuration: number; // seconds
  maxDuration: number; // seconds
  targetLanguage: string;
}

export enum ProcessingStatus {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  ANALYZING = 'ANALYZING', // Gemini VAD & Transcription
  TRANSLATING = 'TRANSLATING',
  READY = 'READY',
  ERROR = 'ERROR'
}

export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh', name: 'Chinese (Simplified)' },
  { code: 'ru', name: 'Russian' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
];

// --- Auth & Admin Types ---

export type UserRole = 'user' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: number;
  lastLoginAt: number;
  googleDriveConnected?: boolean;
}

export interface SessionLog {
  id: string;
  userId: string;
  userEmail: string;
  startTime: number;
  endTime?: number;
  durationSeconds?: number;
}

export interface UserProjectData {
  userId: string;
  subtitles: Subtitle[];
  lastEdited: number;
  mediaName?: string;
}

// --- Activity Logging ---

export type ActivityType = 'UPLOAD' | 'GENERATE' | 'TRANSLATE' | 'EXPORT';

export interface ActivityLog {
  id: string;
  userId: string;
  userEmail: string;
  timestamp: number;
  type: ActivityType;
  details: {
    fileName?: string;
    detectedLanguage?: string;
    targetLanguage?: string;
    itemCount?: number; // Number of subtitles
    format?: string; // For exports
  };
}

export interface GenerationResult {
  subtitles: Subtitle[];
  detectedLanguage: string;
}