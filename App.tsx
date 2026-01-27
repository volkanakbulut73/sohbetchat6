import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPocketBaseClient } from './services/pocketbase';
import { MIRCProvider } from './context/MIRCContext';
import { User, Room, Message, PrivateMessage, UserRole } from './types';
import { BOT_NAME, DEFAULT_AVATAR } from './constants';
import { generateBotResponse, getApiKey } from './services/geminiService';
import MusicPlayer from './components/MusicPlayer';
import UserList from './components/UserList';
import ChatInput from './components/ChatInput';
import MessageList from './components/MessageList';
import { LogOut, Hash, Plus, Command, Bot, Users, Loader2, Key, Mail, User as UserIcon, LockKeyhole, WifiOff, X, MessageCircle, ChevronDown, Check, AlertTriangle } from 'lucide-react';

export interface CuteMIRCProps {
    pocketbaseUrl: string;
    className?: string;
}

// Define the View State to switch between Room and Private Chat
type ViewState = 
    | { type: 'room'; id: string }
    | { type: 'pm'; userId: string };

const CuteMIRC: React.FC<CuteMIRCProps> = ({ pocketbaseUrl, className }) => {
  const pb = useMemo(() => createPocketBaseClient(pocketbaseUrl), [pocketbaseUrl]);

  // --- Core State ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [currentView, setCurrentView] = useState<ViewState>({ type: 'room', id: '' });
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);

  // --- Message State ---
  const [dbMessages, setDbMessages] = useState<Message[]>([]);
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [privateMessages, setPrivateMessages] = useState<Record<string, PrivateMessage[]>>({});
  
  // --- User State ---
  const [users, setUsers] = useState<User[]>([]);
  const [usersMap, setUsersMap] = useState<Map<string, User>>(new Map());
  const [activePMs, setActivePMs] = useState<User[]>([]);
  const [unreadPMs, setUnreadPMs] = useState<Set<string>>(new Set());

  // --- UI Control State ---
  const [showMobileUserList, setShowMobileUserList] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permissionError, setPermissionError] = useState(false);
  const [realtimeError, setRealtimeError] = useState(false);
  const [pmError, setPmError] = useState(false);
  const [showRoomDropdown, setShowRoomDropdown] = useState(false);
  const [showTabOverflow, setShowTabOverflow] = useState(false);
  
  // --- Auth State ---
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState(''); 
  const [hasApiKey, setHasApiKey] = useState(false);
  const [showKeySelector, setShowKeySelector] = useState(false);

  // --- Refs ---
  const roomDropdownRef = useRef<HTMLDivElement>(null);
  const usersMapRef = useRef(usersMap);
  const currentUserRef = useRef(currentUser);
  const activePMsRef = useRef(activePMs);
  const currentViewRef = useRef(currentView);

  useEffect(() => { usersMapRef.current = usersMap; }, [usersMap]);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);
  useEffect(() => { activePMsRef.current = activePMs; }, [activePMs]);
  useEffect(() => { currentViewRef.current = currentView; }, [currentView]);

  // Click Outside Room Dropdown Logic
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (roomDropdownRef.current && !roomDropdownRef.current.contains(event.target as Node)) {
        setShowRoomDropdown(false);
      }
    };
    if (showRoomDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showRoomDropdown]);

  // --- Helpers ---
  const isModerator = (user: User | null) => user?.role === UserRole.ADMIN || user?.role === UserRole.OPERATOR;
  const isAdmin = (user: User | null) => user?.role === UserRole.ADMIN;

  const currentRoomObj = useMemo(() => 
    rooms.find(r => r.id === activeRoomId) || null
  , [rooms, activeRoomId]);

  const allPublicMessages = useMemo(() => {
      const combined = [...dbMessages, ...localMessages];
      return combined.sort((a, b) => new Date(a.created).getTime() - new Date(b.created).getTime());
  }, [dbMessages, localMessages]);

  // --- Gemini API Key Check ---
  useEffect(() => {
    const checkKey = async () => {
        const key = getApiKey();
        if (key && key.trim() !== '') {
            setHasApiKey(true);
            return;
        }
        const win = window as any;
        if (win.aistudio) {
            setShowKeySelector(true);
            try {
                const selected = await win.aistudio.hasSelectedApiKey();
                if (selected) {
                    setHasApiKey(true);
                    setShowKeySelector(false);
                }
            } catch (e) { console.warn("AI Studio key check failed", e); }
        }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
      const win = window as any;
      if (win.aistudio && win.aistudio.openSelectKey) {
          try {
              await win.aistudio.openSelectKey();
              setHasApiKey(true); 
              setShowKeySelector(false);
          } catch (e) {
              alert("Key selection failed. Please try again.");
          }
      }
  };

  // --- Data Fetching ---
  const fetchUsers = useCallback(async () => {
    if (!pb.authStore.isValid) return;

    const botUser: User = { 
        id: 'bot_ai', 
        username: BOT_NAME, 
        role: UserRole.BOT, 
        isOnline: true, 
        avatar: 'https://cdn-icons-png.flaticon.com/512/4712/4712027.png',
        created: new Date().toISOString(),
        updated: new Date().toISOString()
    };
    
    let fetchedUsers: User[] = [];
    try {
        fetchedUsers = await pb.collection('users').getFullList<User>({ sort: 'username', requestKey: null });
    } catch(e) { console.error("Fetch users error", e); }

    const processedUsers = [...fetchedUsers];
    if (pb.authStore.model) {
        const myId = pb.authStore.model.id;
        if (!processedUsers.find(u => u.id === myId)) {
            processedUsers.push({
                id: myId,
                username: pb.authStore.model.username,
                role: (pb.authStore.model.role as UserRole) || UserRole.USER,
                isOnline: true,
                created: pb.authStore.model.created,
                updated: new Date().toISOString()
            } as User);
        }
    }

    const allUsers = [...processedUsers.filter(u => u.id !== 'bot_ai'), botUser];
    setUsers(allUsers);
    setUsersMap(new Map(allUsers.map(u => [u.id, u])));
  }, [pb]);

  // Heartbeat
  useEffect(() => {
    if (!currentUser) return;
    const sendHeartbeat = async () => {
        if (document.hidden) return;
        try { 
            await pb.collection('users').update(currentUser.id, { isOnline: true }); 
            setPermissionError(false);
        } catch (e: any) {
            if (e.status === 403 || e.status === 404) setPermissionError(true);
        }
    };
    const intervalId = setInterval(sendHeartbeat, 30000); 
    const handleVisibility = () => { if (!document.hidden) { sendHeartbeat(); fetchUsers(); } };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => { clearInterval(intervalId); document.removeEventListener("visibilitychange", handleVisibility); };
  }, [currentUser, pb, fetchUsers]);

  // Initial Data
  useEffect(() => {
    const init = async () => {
      if (pb.authStore.isValid && pb.authStore.model) {
        try {
            const freshMe = await pb.collection('users').getOne(pb.authStore.model.id);
            if (freshMe.banned) { pb.authStore.clear(); return; }
            setCurrentUser({ ...freshMe, role: freshMe.role as UserRole, isOnline: true } as User);
        } catch (e) { pb.authStore.clear(); }
      }
    };
    init();
  }, [pb]);

  // Rooms
  useEffect(() => {
      if (!currentUser) return;
      const loadRooms = async () => {
        try {
            const roomsList = await pb.collection('rooms').getFullList<Room>({ sort: 'created' });
            setRooms(roomsList);
            if (roomsList.length > 0) {
                setActiveRoomId(roomsList[0].id);
                setCurrentView({ type: 'room', id: roomsList[0].id });
            }
        } catch (e) { console.error("Error fetching rooms", e); }
      };
      loadRooms();
  }, [pb, currentUser]);

  // Realtime Subscriptions
  useEffect(() => {
    if (!activeRoomId || !currentUser) return;
    const fetchMessages = async () => {
      try {
          const msgs = await pb.collection('messages').getList<Message>(1, 50, {
            filter: `room="${activeRoomId}"`,
            sort: '-created',
            expand: 'user',
          });
          setDbMessages(msgs.items.reverse());
      } catch (e) { }
    };
    setLocalMessages([]);
    fetchMessages();
    const initSub = async () => {
        try {
            await pb.collection('messages').subscribe('*', (e) => {
                setRealtimeError(false);
                if (e.action === 'create' && e.record.room === activeRoomId) {
                    const newMsg = e.record as unknown as Message;
                    if (!newMsg.expand?.user && newMsg.user) {
                        newMsg.expand = { user: usersMapRef.current.get(newMsg.user) };
                    }
                    setDbMessages(prev => prev.find(m => m.id === newMsg.id) ? prev : [...prev, newMsg]);
                }
            });
        } catch (err) { setRealtimeError(true); }
    };
    initSub();
    return () => { pb.collection('messages').unsubscribe('*').catch(()=>{}); };
  }, [activeRoomId, pb, currentUser]);

  // --- Auth Handlers ---
  const handleAuth = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!email || !password || (authMode === 'register' && !username)) return;
    setIsLoading(true);
    try {
        if (authMode === 'register') {
            await pb.collection('users').create({ username, email, password, passwordConfirm: password, emailVisibility: true, role: 'user', isOnline: true });
        }
        await pb.collection('users').authWithPassword(email, password);
        const model = pb.authStore.model;
        if (model) {
            if (model.banned) { alert("Banned."); pb.authStore.clear(); setIsLoading(false); return; }
            await pb.collection('users').update(model.id, { isOnline: true });
            setCurrentUser({ id: model.id, username: model.username, role: model.role as UserRole, isOnline: true, created: model.created, updated: model.updated, avatar: model.avatar ? pb.files.getUrl(model, model.avatar) : undefined });
        }
    } catch (e: any) { alert("Auth error: " + e.message); } finally { setIsLoading(false); }
  };

  const handleLogout = async () => {
      if (currentUser) { try { await pb.collection('users').update(currentUser.id, { isOnline: false }); } catch (e) {} }
      pb.authStore.clear();
      setCurrentUser(null);
      setCurrentView({ type: 'room', id: '' });
  };

  const handleSendMessage = async (text: string, file?: File) => {
    if (!currentUser) return;
    
    if (currentView.type === 'room') {
        if (!activeRoomId) return;
        if (currentRoomObj?.isMuted && !isModerator(currentUser)) { alert("Room locked."); return; }
        try {
            if (file) {
                 const fd = new FormData();
                 fd.append('attachment', file);
                 fd.append('text', text || (file.type.startsWith('audio') ? 'Voice Message' : 'Image'));
                 fd.append('user', currentUser.id);
                 fd.append('room', activeRoomId);
                 fd.append('type', file.type.startsWith('audio') ? 'audio' : 'image');
                 await pb.collection('messages').create(fd);
            } else {
                 await pb.collection('messages').create({ text, user: currentUser.id, room: activeRoomId });
            }
            const lower = text.toLowerCase();
            if (lower.includes('workigom') || lower.includes('@bot')) {
                 const history = allPublicMessages.slice(-5).map(m => `${usersMapRef.current.get(m.user)?.username}: ${m.text}`);
                 try {
                    const botResponse = await generateBotResponse(text, history);
                    setLocalMessages(prev => [...prev, { id: Math.random().toString(), text: botResponse, user: 'bot_ai', room: activeRoomId, created: new Date().toISOString() } as unknown as Message]);
                 } catch (e) {}
            }
        } catch (e) {}
    } else if (currentView.type === 'pm') {
        try {
            const fd = new FormData();
            fd.append('sender', currentUser.id);
            fd.append('recipient', currentView.userId);
            if (file) {
                fd.append('attachment', file);
                fd.append('type', file.type.startsWith('audio') ? 'audio' : 'image');
                fd.append('text', text || (file.type.startsWith('audio') ? 'Voice Message' : 'Image'));
            } else {
                fd.append('text', text);
            }
            await pb.collection('private_messages').create(fd);
        } catch (e: any) { if (e.status === 403) setPmError(true); }
    }
  };

  const switchToRoom = (room: Room) => {
      setActiveRoomId(room.id);
      setCurrentView({ type: 'room', id: room.id });
      setShowRoomDropdown(false);
  };

  const switchToPM = (userId: string) => {
      setCurrentView({ type: 'pm', userId });
      setUnreadPMs(prev => { const n = new Set(prev); n.delete(userId); return n; });
      setShowTabOverflow(false);
  };

  const closePMTab = (e: React.MouseEvent, userId: string) => {
      e.stopPropagation();
      setActivePMs(prev => prev.filter(u => u.id !== userId));
      if (currentView.type === 'pm' && currentView.userId === userId) {
          setCurrentView({ type: 'room', id: activeRoomId || '' });
      }
  };

  // --- Render Helpers ---
  const MAX_VISIBLE_TABS = 4;
  const visiblePMs = activePMs.slice(0, MAX_VISIBLE_TABS);
  const overflowPMs = activePMs.slice(MAX_VISIBLE_TABS);
  const messagesToShow = currentView.type === 'room' ? allPublicMessages : (privateMessages[currentView.userId] || []);
  const targetUserForHeader = currentView.type === 'pm' ? usersMap.get(currentView.userId) : null;

  return (
    <MIRCProvider pb={pb}>
      <div className={`flex flex-col h-[100dvh] w-full bg-mirc-darker text-gray-200 overflow-hidden ${className || ''}`}>
        {!currentUser ? (
           <div className="flex items-center justify-center h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
              <div className="bg-slate-800 p-6 md:p-8 rounded-2xl shadow-2xl border border-mirc-pink/30 w-[90%] md:w-96 text-center animate-in fade-in zoom-in duration-300">
                  <div className="mb-6 flex justify-center"><div className="bg-mirc-pink p-4 rounded-full shadow-[0_0_20px_#f472b6]"><Bot size={48} className="text-white" /></div></div>
                  <h1 className="text-2xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-mirc-pink to-mirc-purple">WorkigomChat AI</h1>
                  <p className="text-sm text-gray-400 mb-6 font-mono">{authMode === 'login' ? 'Login' : 'Register'}</p>
                  {!hasApiKey && <div className="mb-6 p-3 bg-red-900/30 border border-red-500/50 rounded text-xs text-red-200"><p>⚠️ API Key Missing</p>{showKeySelector && <button onClick={handleSelectKey} className="mt-2 bg-red-600 px-2 py-1 rounded">Select Key</button>}</div>}
                  <form onSubmit={handleAuth} className="space-y-4">
                      {authMode === 'register' && <input type="text" placeholder="Username" className="w-full p-3 bg-slate-900 border border-slate-700 rounded-lg text-white" value={username} onChange={e=>setUsername(e.target.value)} required />}
                      <input type="text" placeholder="Email" className="w-full p-3 bg-slate-900 border border-slate-700 rounded-lg text-white" value={email} onChange={e=>setEmail(e.target.value)} required />
                      <input type="password" placeholder="Password" className="w-full p-3 bg-slate-900 border border-slate-700 rounded-lg text-white" value={password} onChange={e=>setPassword(e.target.value)} required />
                      <button type="submit" disabled={isLoading} className="w-full bg-mirc-pink text-white font-bold py-3 rounded-lg flex justify-center">{isLoading ? <Loader2 className="animate-spin" /> : (authMode === 'login' ? "Connect" : "Register")}</button>
                  </form>
                  <div className="mt-4 text-xs text-gray-400"><button onClick={() => setAuthMode(authMode==='login'?'register':'login')} className="text-mirc-cyan hover:underline">{authMode==='login'?'Create Account':'Login'}</button></div>
              </div>
           </div>
        ) : (
          <>
            <header className="h-14 bg-slate-800/90 backdrop-blur-md border-b border-gray-700 flex items-center justify-between px-2 gap-2 sticky top-0 z-30 shrink-0">
              <div className="flex items-center gap-3 shrink-0">
                   <div className="w-9 h-9 bg-gradient-to-br from-mirc-pink to-purple-600 rounded-xl shadow-lg shadow-purple-500/20 flex items-center justify-center border border-white/10"><Command size={18} className="text-white" /></div>
                   <div className="relative z-50" ref={roomDropdownRef}>
                      <button 
                        onClick={() => setShowRoomDropdown(!showRoomDropdown)}
                        className={`flex items-center gap-3 px-3 py-1.5 md:px-4 md:py-2 bg-slate-800/50 hover:bg-slate-800 border rounded-full transition-all duration-300 shadow-sm hover:shadow-mirc-cyan/20 ${showRoomDropdown ? 'border-mirc-cyan ring-1 ring-mirc-cyan/30' : 'border-slate-700'}`}
                      >
                          <div className={`p-1.5 rounded-full shrink-0 transition-colors ${currentRoomObj?.isMuted ? 'bg-red-500/20 text-red-400' : 'bg-mirc-cyan/20 text-mirc-cyan'}`}>{currentRoomObj?.isMuted ? <LockKeyhole size={14} /> : <Hash size={14} />}</div>
                          <div className="flex flex-col items-start text-left hidden md:flex">
                              <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider leading-none mb-0.5">Channel</span>
                              <span className="text-sm font-bold text-gray-100 max-w-[100px] truncate leading-none">{currentRoomObj?.name || 'Rooms'}</span>
                          </div>
                          <ChevronDown size={14} className={`transition-transform ${showRoomDropdown ? 'rotate-180 text-white' : 'text-gray-500'}`} />
                      </button>
                      {showRoomDropdown && (
                        <div className="absolute top-full left-0 mt-3 w-72 bg-slate-900/95 backdrop-blur-xl border border-gray-700/80 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-top-4 duration-200 overflow-hidden ring-1 ring-white/10 origin-top-left z-[60]">
                            <div className="px-5 py-3 bg-slate-950/80 border-b border-gray-800 flex justify-between items-center"><h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Channels</h3><span className="text-[10px] bg-slate-800 text-gray-500 px-1.5 py-0.5 rounded border border-slate-700">{rooms.length}</span></div>
                            <div className="max-h-[320px] overflow-y-auto custom-scrollbar p-2 space-y-1">
                                {rooms.map(r => (
                                    <button key={r.id} onClick={() => switchToRoom(r)} className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-3 group relative ${activeRoomId === r.id ? 'bg-gradient-to-r from-mirc-pink/20 to-purple-500/10 border border-mirc-pink/30' : 'hover:bg-white/5 border border-transparent'}`}>
                                        <div className={`p-2 rounded-lg shrink-0 ${activeRoomId === r.id ? 'bg-mirc-pink text-white shadow-lg shadow-pink-500/30' : 'bg-slate-800 text-gray-500'}`}>{r.isMuted ? <LockKeyhole size={16}/> : <Hash size={16} />}</div>
                                        <div className="flex-1 min-w-0"><div className={`font-bold text-sm truncate ${activeRoomId === r.id ? 'text-pink-100' : 'text-gray-300'}`}>{r.name}</div><div className="text-xs text-gray-600 truncate font-mono">{r.topic || 'No topic'}</div></div>
                                        {activeRoomId === r.id && <div className="absolute right-3 w-2 h-2 rounded-full bg-mirc-pink animate-pulse" />}
                                    </button>
                                ))}
                            </div>
                        </div>
                      )}
                   </div>
              </div>

              <div className="flex-1 flex items-center gap-1 overflow-x-auto scrollbar-hide">
                  {visiblePMs.map(u => (
                      <div key={u.id} onClick={() => switchToPM(u.id)} className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-t-lg border-t border-x border-gray-700 cursor-pointer min-w-[100px] max-w-[150px] ${currentView.type === 'pm' && currentView.userId === u.id ? 'bg-slate-700 text-white border-b-slate-700 mb-[-1px] z-10' : 'bg-slate-900 text-gray-400 hover:bg-slate-800'} ${unreadPMs.has(u.id) ? 'animate-flash' : ''}`}>
                          <div className="relative"><img src={u.avatar || DEFAULT_AVATAR} className="w-4 h-4 rounded-full" /><span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-slate-900 ${u.isOnline ? 'bg-green-500' : 'bg-gray-500'}`} /></div>
                          <span className="text-xs truncate flex-1">{u.username}</span>
                          <button onClick={(e) => closePMTab(e, u.id)} className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-500 rounded-full transition-all"><X size={10} /></button>
                      </div>
                  ))}
              </div>

              <div className="flex-1 flex justify-end items-center gap-2 shrink-0">
                  <div className="hidden md:block"><MusicPlayer /></div>
                  <button onClick={() => setShowMobileUserList(!showMobileUserList)} className="md:hidden p-2 text-gray-400"><Users size={20}/></button>
                  <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-red-400"><LogOut size={18}/></button>
              </div>
            </header>
            
            <div className="flex flex-1 overflow-hidden relative">
              <div className="flex-1 flex flex-col bg-slate-900/50 relative min-w-0 min-h-0 w-full">
                  <div className="bg-slate-950/30 border-b border-gray-800 px-4 py-1 flex items-center justify-between text-xs text-gray-500 h-8 shrink-0">
                      {currentView.type === 'room' ? (<span>Topic: {currentRoomObj?.topic || 'Lobby'}</span>) : (<div className="flex items-center gap-2 text-mirc-pink"><span className="font-bold">PRIVATE</span><span className="text-gray-400">{targetUserForHeader?.username}</span></div>)}
                      {realtimeError && <span className="text-red-500 flex items-center gap-1"><WifiOff size={10}/></span>}
                  </div>
                  <MessageList messages={messagesToShow as Message[]} currentUser={currentUser} usersMap={usersMap} isPrivate={currentView.type === 'pm'} />
                  <ChatInput onSendMessage={handleSendMessage} allowAttachments={currentView.type === 'pm'} disabled={currentView.type === 'room' && currentRoomObj?.isMuted && !isModerator(currentUser)} isLocked={currentView.type === 'room' && currentRoomObj?.isMuted} />
              </div>
              <div className={`fixed inset-y-0 right-0 z-40 bg-mirc-dark border-l border-gray-700 transition-transform duration-300 md:relative md:translate-x-0 md:block h-full ${showMobileUserList ? 'translate-x-0' : 'translate-x-full'}`}>
                  <UserList users={users} currentUserId={currentUser.id} onOpenPrivateChat={(u) => { if (!activePMs.find(p=>p.id===u.id)) setActivePMs(prev=>[...prev, u]); switchToPM(u.id); }} currentUserRole={currentUser.role} onRefresh={fetchUsers} permissionError={permissionError} />
              </div>
            </div>
          </>
        )}
      </div>
    </MIRCProvider>
  );
};

export default CuteMIRC;