import React, { useState } from 'react';
import { Cloud, Check, Loader2, FileVideo, HardDrive, LogOut } from 'lucide-react';

interface GoogleDrivePickerProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'import' | 'export';
  isConnected: boolean;
  onConnect: () => void;
  onSelectFile?: (fileUrl: string, fileName: string) => void;
  onExport?: () => void;
}

const GoogleDrivePicker: React.FC<GoogleDrivePickerProps> = ({
  isOpen,
  onClose,
  mode,
  isConnected,
  onConnect,
  onSelectFile,
  onExport
}) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleConnect = () => {
    setIsConnecting(true);
    setTimeout(() => {
      setIsConnecting(false);
      onConnect();
    }, 2000);
  };

  const handleFileClick = () => {
    if (mode === 'import' && onSelectFile) {
        setIsProcessing(true);
        setTimeout(() => {
            // Simulate a file from Drive
            onSelectFile("https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4", "Project_Flower_Edit_v2.mp4");
            setIsProcessing(false);
            onClose();
        }, 1500);
    }
  };

  const handleSave = () => {
      if (mode === 'export' && onExport) {
          setIsProcessing(true);
          setTimeout(() => {
              onExport();
              setIsProcessing(false);
              onClose();
          }, 1500);
      }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-[500px] bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="h-14 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between px-6">
          <div className="flex items-center gap-2 text-zinc-100 font-medium">
            <HardDrive size={18} className="text-blue-500" />
            <span>Google Drive Integration</span>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">Close</button>
        </div>

        {/* Content */}
        <div className="p-8 flex flex-col items-center justify-center min-h-[300px]">
          {!isConnected ? (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto relative">
                 <Cloud size={32} className="text-zinc-400" />
                 {isConnecting && (
                    <div className="absolute inset-0 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                 )}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Connect Google Drive</h3>
                <p className="text-sm text-zinc-500 max-w-xs mx-auto">
                  Link your account to import videos directly from the cloud and back up your subtitles automatically.
                </p>
              </div>
              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium text-sm transition-colors flex items-center gap-2 mx-auto disabled:opacity-50"
              >
                {isConnecting ? 'Authenticating...' : 'Link Google Account'}
              </button>
            </div>
          ) : (
            <div className="w-full space-y-6">
               <div className="flex items-center justify-between bg-blue-500/10 border border-blue-500/20 px-4 py-3 rounded-lg">
                  <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold text-white">
                        G
                     </div>
                     <div>
                        <p className="text-sm font-medium text-blue-100">Google Drive Connected</p>
                        <p className="text-[10px] text-blue-300">user@example.com</p>
                     </div>
                  </div>
                  <Check size={16} className="text-blue-400" />
               </div>

               {mode === 'import' ? (
                   <div className="space-y-3">
                      <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Recent Files</p>
                      <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                         {[1, 2, 3].map((i) => (
                             <button 
                               key={i}
                               onClick={handleFileClick}
                               disabled={isProcessing}
                               className="w-full flex items-center gap-3 p-3 rounded-lg bg-zinc-950/50 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 transition-colors group text-left"
                             >
                                <div className="w-8 h-8 rounded bg-zinc-900 flex items-center justify-center shrink-0">
                                   <FileVideo size={16} className="text-zinc-500 group-hover:text-zinc-300" />
                                </div>
                                <div className="flex-1 min-w-0">
                                   <p className="text-sm text-zinc-300 truncate group-hover:text-white">Project_Flower_Edit_v{i}.mp4</p>
                                   <p className="text-[10px] text-zinc-600">Modified {i} hour ago • 45.2 MB</p>
                                </div>
                                {isProcessing ? <Loader2 size={16} className="animate-spin text-zinc-500" /> : <div className="text-xs text-zinc-600 group-hover:text-zinc-400">Select</div>}
                             </button>
                         ))}
                      </div>
                   </div>
               ) : (
                   <div className="text-center space-y-6 py-4">
                      <div className="w-16 h-16 bg-zinc-800/50 rounded-full flex items-center justify-center mx-auto text-emerald-500">
                         <Cloud size={32} />
                      </div>
                      <div>
                         <h3 className="text-lg font-medium text-white">Save Project to Drive</h3>
                         <p className="text-sm text-zinc-500 mt-2">
                             Exporting subtitles and project metadata to <span className="text-zinc-300">/My Drive/AminaWork_Exports/</span>
                         </p>
                      </div>
                      <button
                        onClick={handleSave}
                        disabled={isProcessing}
                        className="w-full py-3 bg-zinc-100 hover:bg-white text-black rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isProcessing ? <Loader2 size={16} className="animate-spin" /> : 'Confirm Upload'}
                      </button>
                   </div>
               )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GoogleDrivePicker;