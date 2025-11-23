import React, { useEffect, useState } from 'react';
import { User, SessionLog, ActivityLog } from '../types';
import { mockBackend } from '../services/mockBackend';
import { Users, Clock, Activity, ArrowLeft, FileText, Sparkles, Globe, Upload } from 'lucide-react';

interface AdminDashboardProps {
  onClose: () => void; // Actually "Back to Portal"
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onClose }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [sessions, setSessions] = useState<SessionLog[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'sessions' | 'logs'>('overview');

  useEffect(() => {
    // Load data from persistent storage
    setUsers(mockBackend.getAllUsers());
    setSessions(mockBackend.getAllSessions());
    setActivities(mockBackend.getAllActivities());
  }, []);

  const totalUsageSeconds = sessions.reduce((acc, s) => acc + (s.durationSeconds || 0), 0);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'UPLOAD': return <Upload size={14} className="text-blue-400" />;
      case 'GENERATE': return <Sparkles size={14} className="text-amber-400" />;
      case 'TRANSLATE': return <Globe size={14} className="text-indigo-400" />;
      case 'EXPORT': return <FileText size={14} className="text-emerald-400" />;
      default: return <Activity size={14} className="text-zinc-400" />;
    }
  };

  return (
    <div className="h-screen w-screen bg-zinc-950 flex flex-col text-zinc-100 overflow-hidden">
      {/* Header */}
      <header className="h-16 border-b border-zinc-800 bg-zinc-900 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-4">
           <button 
             onClick={onClose} 
             className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors text-xs font-medium"
           >
             <ArrowLeft size={14} />
             Return to Portal
           </button>
           <div className="h-6 w-px bg-zinc-800"></div>
           <h1 className="text-lg font-bold text-zinc-100 flex items-center gap-2 font-serif">
             <Activity size={18} className="text-indigo-500" />
             Command Center
           </h1>
        </div>
        <div className="flex bg-zinc-800 p-1 rounded-lg">
           <button onClick={() => setActiveTab('overview')} className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === 'overview' ? 'bg-zinc-700 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'}`}>Overview</button>
           <button onClick={() => setActiveTab('users')} className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === 'users' ? 'bg-zinc-700 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'}`}>Users</button>
           <button onClick={() => setActiveTab('logs')} className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === 'logs' ? 'bg-zinc-700 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'}`}>Work Logs</button>
           <button onClick={() => setActiveTab('sessions')} className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === 'sessions' ? 'bg-zinc-700 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'}`}>Sessions</button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-6xl mx-auto space-y-8">
          
          {activeTab === 'overview' && (
             <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
               <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-xl">
                 <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-zinc-400">Total Users</h3>
                    <Users size={18} className="text-indigo-400" />
                 </div>
                 <p className="text-3xl font-bold text-white">{users.length}</p>
                 <p className="text-xs text-zinc-500 mt-2">Registered accounts</p>
               </div>
               
               <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-xl">
                 <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-zinc-400">Total Activities</h3>
                    <FileText size={18} className="text-blue-400" />
                 </div>
                 <p className="text-3xl font-bold text-white">{activities.length}</p>
                 <p className="text-xs text-zinc-500 mt-2">Work actions logged</p>
               </div>

               <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-xl">
                 <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-zinc-400">Total Sessions</h3>
                    <Activity size={18} className="text-emerald-400" />
                 </div>
                 <p className="text-3xl font-bold text-white">{sessions.length}</p>
                 <p className="text-xs text-zinc-500 mt-2">Logins detected</p>
               </div>

               <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-xl">
                 <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-zinc-400">Total Usage Time</h3>
                    <Clock size={18} className="text-amber-400" />
                 </div>
                 <p className="text-3xl font-bold text-white">{(totalUsageSeconds / 60).toFixed(1)} m</p>
                 <p className="text-xs text-zinc-500 mt-2">Cumulative active minutes</p>
               </div>
             </div>
          )}

          {activeTab === 'users' && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
               <table className="w-full text-left text-sm">
                 <thead className="bg-zinc-950 text-zinc-400 border-b border-zinc-800">
                   <tr>
                     <th className="p-4 font-medium">User</th>
                     <th className="p-4 font-medium">Role</th>
                     <th className="p-4 font-medium">Joined</th>
                     <th className="p-4 font-medium">Last Active</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-zinc-800">
                   {users.map(user => (
                     <tr key={user.id} className="hover:bg-zinc-800/50 transition-colors">
                       <td className="p-4">
                         <div className="flex flex-col">
                            <span className="font-medium text-white">{user.name}</span>
                            <span className="text-xs text-zinc-500">{user.email}</span>
                         </div>
                       </td>
                       <td className="p-4">
                         <span className={`text-xs px-2 py-1 rounded-full border ${user.role === 'admin' ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}>
                            {user.role}
                         </span>
                       </td>
                       <td className="p-4 text-zinc-400">{new Date(user.createdAt).toLocaleDateString()}</td>
                       <td className="p-4 text-zinc-400">{new Date(user.lastLoginAt).toLocaleString()}</td>
                     </tr>
                   ))}
                 </tbody>
               </table>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
               <table className="w-full text-left text-sm">
                 <thead className="bg-zinc-950 text-zinc-400 border-b border-zinc-800">
                   <tr>
                     <th className="p-4 font-medium">Timestamp</th>
                     <th className="p-4 font-medium">User</th>
                     <th className="p-4 font-medium">Action</th>
                     <th className="p-4 font-medium">Details (File / Lang)</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-zinc-800">
                   {activities.map(act => (
                     <tr key={act.id} className="hover:bg-zinc-800/50 transition-colors">
                       <td className="p-4 text-zinc-500 text-xs">
                         {new Date(act.timestamp).toLocaleString()}
                       </td>
                       <td className="p-4 text-zinc-300">
                         {act.userEmail}
                       </td>
                       <td className="p-4">
                         <div className="flex items-center gap-2">
                            {getActivityIcon(act.type)}
                            <span className="font-medium text-xs tracking-wide">{act.type}</span>
                         </div>
                       </td>
                       <td className="p-4 text-zinc-400 text-xs">
                         <div className="flex flex-col gap-1">
                            {act.details.fileName && <span className="text-zinc-300">{act.details.fileName}</span>}
                            <div className="flex gap-2">
                                {act.details.detectedLanguage && (
                                    <span className="bg-zinc-800 px-1.5 py-0.5 rounded text-[10px] text-zinc-500 border border-zinc-700">
                                       Detected: {act.details.detectedLanguage}
                                    </span>
                                )}
                                {act.details.targetLanguage && (
                                    <span className="bg-indigo-900/30 px-1.5 py-0.5 rounded text-[10px] text-indigo-400 border border-indigo-500/20">
                                       → {act.details.targetLanguage}
                                    </span>
                                )}
                                {act.details.itemCount && (
                                    <span className="text-zinc-600">({act.details.itemCount} items)</span>
                                )}
                            </div>
                         </div>
                       </td>
                     </tr>
                   ))}
                   {activities.length === 0 && (
                     <tr>
                        <td colSpan={4} className="p-8 text-center text-zinc-500">No activity logged yet.</td>
                     </tr>
                   )}
                 </tbody>
               </table>
            </div>
          )}

          {activeTab === 'sessions' && (
             <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-950 text-zinc-400 border-b border-zinc-800">
                  <tr>
                    <th className="p-4 font-medium">Time</th>
                    <th className="p-4 font-medium">User</th>
                    <th className="p-4 font-medium">Duration</th>
                    <th className="p-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {sessions.map(session => (
                    <tr key={session.id} className="hover:bg-zinc-800/50 transition-colors">
                      <td className="p-4 text-zinc-400">
                        {new Date(session.startTime).toLocaleString()}
                      </td>
                      <td className="p-4 text-zinc-300">{session.userEmail}</td>
                      <td className="p-4 text-zinc-400">
                        {session.durationSeconds 
                          ? `${(session.durationSeconds / 60).toFixed(1)} min` 
                          : '-'}
                      </td>
                      <td className="p-4">
                        {session.endTime ? (
                          <span className="text-xs text-zinc-500">Completed</span>
                        ) : (
                          <span className="text-xs text-emerald-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Active
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
           </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;