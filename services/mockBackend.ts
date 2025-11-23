import { User, UserRole, SessionLog, UserProjectData, Subtitle, ActivityLog, ActivityType } from "../types";

// Keys for LocalStorage Persistence
const USERS_KEY = 'amina_app_v2_users';
const SESSIONS_KEY = 'amina_app_v2_sessions';
const ACTIVITY_KEY = 'amina_app_v2_activities';
const DATA_KEY = 'amina_app_v2_data';
const CURRENT_USER_KEY = 'amina_app_v2_active_uid';

class LocalStorageBackend {
  
  // --- Authentication ---

  async signup(email: string, password: string, name: string): Promise<User> {
    const users = this.getUsers();
    
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      throw new Error("This email is already associated with an account. Please log in.");
    }

    const newUser: User = {
      id: `u_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      email,
      name,
      role: 'user',
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
      googleDriveConnected: false
    };

    users.push(newUser);
    this.saveUsers(users);
    
    this.startSession(newUser);
    localStorage.setItem(CURRENT_USER_KEY, newUser.id);
    
    return newUser;
  }

  async login(identifier: string, password: string): Promise<User> {
    // --- ADMIN OVERRIDE FOR VERCEL DEPLOYMENT ---
    if (identifier === 'oussanat' && password === 'oussanat98') {
       const adminUser: User = {
          id: 'admin_static_root',
          email: 'admin@amina.work',
          name: 'Oussanat (Admin)',
          role: 'admin',
          createdAt: 0, 
          lastLoginAt: Date.now(),
          googleDriveConnected: true
       };
       this.startSession(adminUser);
       localStorage.setItem(CURRENT_USER_KEY, adminUser.id);
       return adminUser;
    }

    const users = this.getUsers();
    const user = users.find(u => 
      u.email.toLowerCase() === identifier.toLowerCase() || 
      u.name === identifier
    );

    if (!user) {
      throw new Error("Invalid credentials. Please check your username/email and password.");
    }

    user.lastLoginAt = Date.now();
    
    const userIndex = users.findIndex(u => u.id === user.id);
    if (userIndex !== -1) {
        users[userIndex] = user;
        this.saveUsers(users);
    }

    this.startSession(user);
    localStorage.setItem(CURRENT_USER_KEY, user.id);

    return user;
  }

  async updateUserDriveStatus(userId: string, isConnected: boolean): Promise<void> {
      const users = this.getUsers();
      const index = users.findIndex(u => u.id === userId);
      if (index !== -1) {
          users[index].googleDriveConnected = isConnected;
          this.saveUsers(users);
      }
  }

  logout() {
    const userId = localStorage.getItem(CURRENT_USER_KEY);
    if (userId) {
      this.endSession(userId);
    }
    localStorage.removeItem(CURRENT_USER_KEY);
  }

  getCurrentUser(): User | null {
    const userId = localStorage.getItem(CURRENT_USER_KEY);
    
    if (userId === 'admin_static_root') {
        return {
            id: 'admin_static_root',
            email: 'admin@amina.work',
            name: 'Oussanat (Admin)',
            role: 'admin',
            createdAt: 0,
            lastLoginAt: Date.now(),
            googleDriveConnected: true
        };
    }

    if (!userId) return null;
    const users = this.getUsers();
    return users.find(u => u.id === userId) || null;
  }

  // --- Data Persistence ---

  async saveUserWork(userId: string, subtitles: Subtitle[], mediaName?: string) {
    const allData = this.getAllProjectData();
    const userData: UserProjectData = {
      userId,
      subtitles,
      lastEdited: Date.now(),
      mediaName: mediaName || 'Untitled Project'
    };
    const existingIndex = allData.findIndex(d => d.userId === userId);
    if (existingIndex >= 0) {
      allData[existingIndex] = userData;
    } else {
      allData.push(userData);
    }
    localStorage.setItem(DATA_KEY, JSON.stringify(allData));
  }

  async loadUserWork(userId: string): Promise<UserProjectData | null> {
    const allData = this.getAllProjectData();
    return allData.find(d => d.userId === userId) || null;
  }

  // --- Admin / Logging ---

  logActivity(userId: string, type: ActivityType, details: ActivityLog['details']) {
    try {
      const activities = this.getActivities();
      const currentUser = this.getCurrentUser();
      
      const newLog: ActivityLog = {
        id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        userId: userId,
        userEmail: currentUser?.email || 'Unknown',
        timestamp: Date.now(),
        type,
        details
      };

      activities.unshift(newLog); // Newest first
      // Keep last 1000 logs to prevent storage overflow
      if (activities.length > 1000) activities.pop();
      
      localStorage.setItem(ACTIVITY_KEY, JSON.stringify(activities));
    } catch (e) {
      console.error("Failed to log activity", e);
    }
  }

  getAllActivities(): ActivityLog[] {
    return this.getActivities();
  }

  private startSession(user: User) {
    const sessions = this.getSessions();
    const newSession: SessionLog = {
      id: `s_${Date.now()}`,
      userId: user.id,
      userEmail: user.email,
      startTime: Date.now()
    };
    sessions.push(newSession);
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  }

  private endSession(userId: string) {
    const sessions = this.getSessions();
    const session = sessions.reverse().find(s => s.userId === userId && !s.endTime);
    if (session) {
      session.endTime = Date.now();
      session.durationSeconds = (session.endTime - session.startTime) / 1000;
      
      const freshSessions = this.getSessions();
      const targetIndex = freshSessions.findIndex(s => s.id === session.id);
      if (targetIndex >= 0) {
        freshSessions[targetIndex] = session;
        localStorage.setItem(SESSIONS_KEY, JSON.stringify(freshSessions));
      }
    }
  }

  getAllSessions(): SessionLog[] {
    return this.getSessions().sort((a, b) => b.startTime - a.startTime);
  }

  getAllUsers(): User[] {
    return this.getUsers();
  }

  // --- Internal Storage Helpers ---

  private getUsers(): User[] {
    try {
      const str = localStorage.getItem(USERS_KEY);
      return str ? JSON.parse(str) : [];
    } catch (e) { return []; }
  }

  private saveUsers(users: User[]) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  private getSessions(): SessionLog[] {
    try {
      const str = localStorage.getItem(SESSIONS_KEY);
      return str ? JSON.parse(str) : [];
    } catch { return []; }
  }

  private getActivities(): ActivityLog[] {
    try {
      const str = localStorage.getItem(ACTIVITY_KEY);
      return str ? JSON.parse(str) : [];
    } catch { return []; }
  }

  private getAllProjectData(): UserProjectData[] {
    try {
      const str = localStorage.getItem(DATA_KEY);
      return str ? JSON.parse(str) : [];
    } catch { return []; }
  }
}

export const mockBackend = new LocalStorageBackend();