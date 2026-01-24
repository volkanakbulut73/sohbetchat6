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

  // --- State ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  
  // VIEW MANAGEMENT
  const [currentView, setCurrentView] = useState<ViewState>({ type: 'room', id: '' });
  
  // Track the *last active room* so when we close a PM or switch back, we go there
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);

  // Messages
  const [dbMessages, setDbMessages] = useState<Message[]>([]);
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  
  const [users, setUsers] = useState<User[]>([]);
  const [usersMap, setUsersMap] = useState<Map<string, User>>(new Map());
  const [showMobileUserList, setShowMobileUserList] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permissionError, setPermissionError] = useState(false);
  const [realtimeError, setRealtimeError] = useState(false);
  const [pmError, setPmError] = useState(false); // Track PM permission errors
  
  // Login & Register
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState(''); 
  
  const [hasApiKey, setHasApiKey] = useState(false);
  const [showKeySelector, setShowKeySelector] = useState(false);
  
  // Active Private Chats (Open Tabs)
  const [activePMs, setActivePMs] = useState<User[]>([]);
  const [privateMessages, setPrivateMessages] = useState<Record<string, PrivateMessage[]>>({});
  const [unreadPMs, setUnreadPMs] = useState<Set<string>>(new Set());

  // Show "More" dropdown for tabs
  const [showTabOverflow, setShowTabOverflow] = useState(false);

  // --- Refs ---
  const usersMapRef = useRef(usersMap);
  const currentUserRef = useRef(currentUser);
  const activePMsRef = useRef(activePMs);
  const currentViewRef = useRef(currentView);
  const usersRef = useRef(users);

  useEffect(() => { usersMapRef.current = usersMap; }, [usersMap]);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);
  useEffect(() => { activePMsRef.current = activePMs; }, [activePMs]);
  useEffect(() => { currentViewRef.current = currentView; }, [currentView]);
  useEffect(() => { usersRef.current = users; }, [users]);

  // --- Helpers ---
  const isModerator = (user: User | null) => user?.role === UserRole.ADMIN || user?.role === UserRole.OPERATOR;
  const isAdmin = (user: User | null) => user?.role === UserRole.ADMIN;

  // Get current Room object easily
  const currentRoomObj = useMemo(() => 
    rooms.find(r => r.id === activeRoomId) || null
  , [rooms, activeRoomId]);

  // Combine DB and Local messages for PUBLIC chat
  const allPublicMessages = useMemo(() => {
      const combined = [...dbMessages, ...localMessages];
      return combined.sort((a, b) => new Date(a.created).getTime() - new Date(b.created).getTime());
  }, [dbMessages, localMessages]);

  // --- API Key Check ---
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
            } catch (e) { console.log("Error checking AI Studio key", e); }
        }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
      const win = window as any;
      if (win.aistudio) {
          try {
              await win.aistudio.openSelectKey();
              setHasApiKey(true); 
              setShowKeySelector(false);
          } catch (e) {
              alert("Key selection failed. Please try again.");
          }
      }
  };

  // --- 1. Fetch Users (Initial & Poll) ---
  const fetchUsers = useCallback(async () => {
    if (!pb.authStore.isValid) return;

    const bot: User = { 
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
        fetchedUsers = await pb.collection('users').getFullList<User>({ 
            sort: 'username', 
            requestKey: null,
            headers: { 'x-no-cache': 'true' }
        });
    } catch(e) { console.error("Fetch users error", e); }

    const processedUsers = fetchedUsers.map(u => {
        // If it's me, force online locally to avoid flicker
        if (pb.authStore.isValid && u.id === pb.authStore.model?.id) {
            return { ...u, isOnline: true };
        }
        return u;
    });

    // Ensure 'Me' exists in the list even if DB hasn't synced
    if (pb.authStore.isValid && pb.authStore.model) {
        const myId = pb.authStore.model.id;
        if (!processedUsers.find(u => u.id === myId)) {
            const me: User = {
                id: myId,
                username: pb.authStore.model.username,
                role: (pb.authStore.model.role as UserRole) || UserRole.USER,
                isOnline: true,
                created: pb.authStore.model.created,
                updated: pb.authStore.model.updated
            };
            processedUsers.push(me);
        }
    }

    const realUsers = processedUsers.filter(u => u.id !== 'bot_ai');
    const allUsers = [...realUsers, bot];
    
    setUsers(allUsers);
    setUsersMap(new Map(allUsers.map(u => [u.id, u])));
  }, [pb]);


  // --- 2. Realtime User Subscription (CRITICAL FIX) ---
  useEffect(() => {
      if (!currentUser) return;

      const subscribeToUsers = async () => {
          try {
            await pb.collection('users').subscribe('*', (e) => {
                const record = e.record as unknown as User;
                const action = e.action; // create, update, delete

                setUsers(currentList => {
                    const bot = currentList.find(u => u.id === 'bot_ai');
                    const realUsers = currentList.filter(u => u.id !== 'bot_ai');
                    
                    let newList = [...realUsers];
                    const existingIndex = newList.findIndex(u => u.id === record.id);

                    if (action === 'delete') {
                        if (existingIndex !== -1) newList.splice(existingIndex, 1);
                    } else if (action === 'create') {
                        if (existingIndex === -1) newList.push(record);
                    } else if (action === 'update') {
                        if (existingIndex !== -1) {
                            newList[existingIndex] = record;
                        } else {
                            newList.push(record);
                        }
                    }

                    if (bot) newList.push(bot);
                    
                    // Update map for quick lookup
                    setUsersMap(new Map(newList.map(u => [u.id, u])));
                    return newList;
                });
            });
          } catch (err) {
              console.error("Realtime user sub failed", err);
          }
      };

      subscribeToUsers();

      return () => {
          pb.collection('users').unsubscribe('*').catch(()=>{});
      };
  }, [currentUser, pb]);


  // --- Heartbeat & Window Focus ---
  useEffect(() => {
    if (!currentUser) return;
    
    // Heartbeat logic
    const heartbeat = async () => {
        try { 
            await pb.collection('users').update(currentUser.id, { isOnline: true }); 
            setPermissionError(false);
        } catch (e: any) {
            if (e.status === 403 || e.status === 404) setPermissionError(true);
        }
    };
    heartbeat();
    const intervalId = setInterval(heartbeat, 15000); // 15s heartbeat

    // Window Focus Refresh
    const handleFocus = () => {
        fetchUsers();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
        clearInterval(intervalId);
        window.removeEventListener('focus', handleFocus);
    };
  }, [currentUser, pb, fetchUsers]);

  // --- Initial Load ---
  useEffect(() => {
    const init = async () => {
      if (pb.authStore.isValid && pb.authStore.model) {
        try {
            const freshMe = await pb.collection('users').getOne(pb.authStore.model.id);
            if (freshMe.banned) {
                alert("You are banned.");
                pb.authStore.clear();
                return;
            }
            setCurrentUser({ ...freshMe, role: freshMe.role as UserRole, isOnline: true } as User);
        } catch (e) { pb.authStore.clear(); }
      }
    };
    init();
  }, [pb]);

  // --- Load Rooms ---
  useEffect(() => {
      if (!currentUser) return;
      const loadRooms = async () => {
        try {
            const roomsList = await pb.collection('rooms').getFullList<Room>({ sort: 'created' });
            setRooms(roomsList);
            if (roomsList.length > 0) {
                const firstRoom = roomsList[0];
                setActiveRoomId(firstRoom.id);
                setCurrentView({ type: 'room', id: firstRoom.id });
            } else if (pb.authStore.isValid) {
                // Auto create default
                try {
                    const newRoom = await pb.collection('rooms').create({ name: 'General', topic: 'Lobby', isMuted: false });
                    setRooms([newRoom as unknown as Room]);
                    setActiveRoomId(newRoom.id);
                    setCurrentView({ type: 'room', id: newRoom.id });
                } catch (err) {}
            }
        } catch (e) { console.error("Error fetching rooms", e); }
      };
      loadRooms();
  }, [pb, currentUser]);

  // --- Public Message Subscription ---
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
    setDbMessages([]);
    fetchMessages();

    const initSub = async () => {
        try {
            await pb.collection('messages').subscribe('*', function (e) {
                setRealtimeError(false);
                if (e.action === 'create' && e.record.room === activeRoomId) {
                    const newMsg = e.record as unknown as Message;
                    if (!newMsg.expand?.user && newMsg.user) {
                        newMsg.expand = { user: usersMapRef.current.get(newMsg.user) };
                    }
                    setDbMessages((prev) => {
                        if (prev.find(m => m.id === newMsg.id)) return prev;
                        return [...prev, newMsg];
                    });
                }
            });
        } catch (err) { setRealtimeError(true); }
    };
    initSub();

    return () => { pb.collection('messages').unsubscribe('*').catch(()=>{}); };
  }, [activeRoomId, pb]);

  // --- Private Message Subscription ---
  useEffect(() => {
      if (!currentUser) return;

      const initPMSub = async () => {
          try {
              const recents = await pb.collection('private_messages').getList<PrivateMessage>(1, 200, {
                  filter: `sender="${currentUser.id}" || recipient="${currentUser.id}"`,
                  sort: 'created' 
              });
              
              setPmError(false);
              
              const pmMap: Record<string, PrivateMessage[]> = {};
              
              recents.items.forEach(pm => {
                  const otherId = pm.sender === currentUser.id ? pm.recipient : pm.sender;
                  if (!pmMap[otherId]) pmMap[otherId] = [];
                  pmMap[otherId].push(pm);
              });
              setPrivateMessages(pmMap);

              await pb.collection('private_messages').subscribe('*', (e) => {
                  if (e.action === 'create') {
                      const pm = e.record as unknown as PrivateMessage;
                      const myId = currentUserRef.current?.id;
                      
                      if (pm.recipient === myId || pm.sender === myId) {
                          const otherUserId = pm.sender === myId ? pm.recipient : pm.sender;
                          const otherUser = usersMapRef.current.get(otherUserId);
                          
                          if (otherUser) {
                              setPrivateMessages(prev => ({
                                  ...prev,
                                  [otherUserId]: [...(prev[otherUserId] || []), pm]
                              }));

                              if (pm.recipient === myId) {
                                  const isActive = activePMsRef.current.some(u => u.id === otherUserId);
                                  if (!isActive) {
                                      setActivePMs(prev => [...prev, otherUser]);
                                  }
                                  
                                  const currentV = currentViewRef.current;
                                  if (currentV.type !== 'pm' || currentV.userId !== otherUserId) {
                                      setUnreadPMs(prev => new Set(prev).add(otherUserId));
                                  }
                              }
                          }
                      }
                  }
              });
          } catch (err: any) { 
              if (err.status === 403) {
                  setPmError(true);
              }
          }
      };
      initPMSub();
      return () => { pb.collection('private_messages').unsubscribe('*').catch(()=>{}); }
  }, [currentUser, pb]);

  // --- User Presence Polling (Fallback) ---
  useEffect(() => {
    if (!currentUser) return;
    fetchUsers();
    // Poll to keep list fresh, but less frequent since we have SSE
    const interval = setInterval(fetchUsers, 10000);
    return () => clearInterval(interval);
  }, [currentUser, fetchUsers]);

  // --- Handlers ---

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
            setPassword('');
        }
    } catch (e: any) { alert("Auth error: " + e.message); } finally { setIsLoading(false); }
  };

  const handleLogout = async () => {
      if (currentUser) { try { await pb.collection('users').update(currentUser.id, { isOnline: false }); } catch (e) {} }
      pb.authStore.clear();
      setCurrentUser(null);
      setCurrentView({ type: 'room', id: '' });
      setDbMessages([]);
      setActivePMs([]);
      setPrivateMessages({});
      setPmError(false);
  };

  const handleSendMessage = async (text: string, file?: File) => {
    if (!currentUser) return;
    
    // ROUTE MESSAGE BASED ON VIEW
    if (currentView.type === 'room') {
        if (!activeRoomId) return;
        if (currentRoomObj?.isMuted && !isModerator(currentUser)) { alert("Room locked."); return; }

        try {
            // Upload attachment if present
            let attachmentId = undefined;
            if (file) {
                 const formData = new FormData();
                 formData.append('attachment', file);
                 // We create message via formData to include file
                 formData.append('text', text || (file.type.startsWith('audio') ? 'Voice Message' : 'Image'));
                 formData.append('user', currentUser.id);
                 formData.append('room', activeRoomId);
                 formData.append('type', file.type.startsWith('audio') ? 'audio' : 'image');
                 await pb.collection('messages').create(formData);
            } else {
                 await pb.collection('messages').create({ text, user: currentUser.id, room: activeRoomId });
            }

            // BOT LOGIC
            const lowerText = text.toLowerCase();
            if (lowerText.includes('gemini') || lowerText.includes('@bot')) {
                 const history = allPublicMessages.slice(-5).map(m => `${usersMapRef.current.get(m.user)?.username}: ${m.text}`);
                 try {
                    const botResponse = await generateBotResponse(text, history);
                    const botMsg: Message = { id: Math.random().toString(), collectionId: 'messages', collectionName: 'messages', created: new Date().toISOString(), updated: new Date().toISOString(), text: botResponse, user: 'bot_ai', room: activeRoomId, type: 'text' };
                    setLocalMessages(prev => [...prev, botMsg]);
                 } catch (e) {}
            }
        } catch (e) {}

    } else if (currentView.type === 'pm') {
        const recipientId = currentView.userId;
        try {
            const formData = new FormData();
            formData.append('sender', currentUser.id);
            formData.append('recipient', recipientId);
            
            if (file) {
                formData.append('attachment', file);
                formData.append('type', file.type.startsWith('audio') ? 'audio' : 'image');
                formData.append('text', text || (file.type.startsWith('audio') ? 'Voice Message' : 'Image'));
            } else {
                formData.append('text', text);
                formData.append('type', 'text');
            }
            await pb.collection('private_messages').create(formData);
        } catch (e: any) { 
             console.error("PM Send error", e); 
             if (e.status === 403) {
                 alert("Cannot send private message: Permission denied. Check API Rules.");
                 setPmError(true);
             }
        }
    }
  };

  const handleOpenPrivateChat = (user: User) => {
      if (user.id === currentUser?.id) return;
      if (!activePMs.find(u => u.id === user.id)) setActivePMs(prev => [...prev, user]);
      
      // Switch view to this user
      setCurrentView({ type: 'pm', userId: user.id });
      setUnreadPMs(prev => { const n = new Set(prev); n.delete(user.id); return n; });
      setShowMobileUserList(false);
  };

  const closePMTab = (e: React.MouseEvent, userId: string) => {
      e.stopPropagation();
      setActivePMs(prev => prev.filter(u => u.id !== userId));
      setUnreadPMs(prev => { const n = new Set(prev); n.delete(userId); return n; });
      
      // If we closed the active view, go back to room
      if (currentView.type === 'pm' && currentView.userId === userId) {
          setCurrentView({ type: 'room', id: activeRoomId || '' });
      }
  };

  const switchToRoom = (room: Room) => {
      setActiveRoomId(room.id);
      setCurrentView({ type: 'room', id: room.id });
  };

  const switchToPM = (userId: string) => {
      setCurrentView({ type: 'pm', userId });
      setUnreadPMs(prev => { const n = new Set(prev); n.delete(userId); return n; });
      setShowTabOverflow(false);
  };

  const createDefaultRoom = async () => {
      if (!isModerator(currentUser)) return;
      try {
          const r = await pb.collection('rooms').create({ name: 'New Room', topic: 'Topic', isMuted: false });
          setRooms(prev => [...prev, r as unknown as Room]);
          switchToRoom(r as unknown as Room);
      } catch(e) {}
  };

  const handleKickUser = async (user: User) => {
    if (!currentUser || !isModerator(currentUser)) return;
    if (!confirm(`Are you sure you want to kick ${user.username}?`)) return;
    try {
        await pb.collection('users').update(user.id, { isOnline: false });
        if (activeRoomId) {
             await pb.collection('messages').create({
                 text: `*** ${user.username} was kicked by ${currentUser.username}`,
                 room: activeRoomId,
                 user: 'bot_ai',
                 type: 'text'
             });
        }
    } catch (e: any) {
        alert("Kick failed: " + e.message);
    }
  };

  const handleBanUser = async (user: User) => {
    if (!currentUser || !isAdmin(currentUser)) return;
    const action = user.banned ? "Unban" : "Ban";
    if (!confirm(`Are you sure you want to ${action} ${user.username}?`)) return;
    try {
        await pb.collection('users').update(user.id, { banned: !user.banned });
        if (activeRoomId) {
             await pb.collection('messages').create({
                 text: `*** ${user.username} was ${user.banned ? 'unbanned' : 'banned'} by ${currentUser.username}`,
                 room: activeRoomId,
                 user: 'bot_ai',
                 type: 'text'
             });
        }
    } catch (e: any) {
        alert(`${action} failed: ` + e.message);
    }
  };

  const handleToggleOp = async (user: User) => {
    if (!currentUser || !isAdmin(currentUser)) return;
    const isOp = user.role === UserRole.OPERATOR;
    if (!confirm(`Are you sure you want to ${isOp ? "demote" : "promote"} ${user.username}?`)) return;
    try {
        const newRole = isOp ? UserRole.USER : UserRole.OPERATOR;
        await pb.collection('users').update(user.id, { role: newRole });
        if (activeRoomId) {
             await pb.collection('messages').create({
                 text: `*** ${user.username} is now ${newRole === UserRole.OPERATOR ? 'an Operator' : 'a User'}`,
                 room: activeRoomId,
                 user: 'bot_ai',
                 type: 'text'
             });
        }
    } catch (e: any) {
        alert("Role change failed: " + e.message);
    }
  };

  // --- Render Helpers ---
  const MAX_VISIBLE_TABS = 4;
  const visiblePMs = activePMs.slice(0, MAX_VISIBLE_TABS);
  const overflowPMs = activePMs.slice(MAX_VISIBLE_TABS);

  // Determine current user for header display
  const targetUserForHeader = currentView.type === 'pm' ? usersMap.get(currentView.userId) : null;

  // Decide which messages to show
  const messagesToShow = currentView.type === 'room' 
      ? allPublicMessages 
      : (privateMessages[currentView.userId] || []);

  return (
    <MIRCProvider pb={pb}>
      <div className={`flex flex-col h-[100dvh] w-full bg-mirc-darker text-gray-200 overflow-hidden ${className || ''}`}>
        {!currentUser ? (
           /* LOGIN SCREEN (Unchanged from original essentially) */
           <div className="flex items-center justify-center h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
              <div className="bg-slate-800 p-6 md:p-8 rounded-2xl shadow-2xl border border-mirc-pink/30 w-[90%] md:w-96 text-center animate-in fade-in zoom-in duration-300">
                  {/* ... Login Form ... */}
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
            {/* HEADER */}
            <header className="h-14 bg-slate-800/90 backdrop-blur-md border-b border-gray-700 flex items-center justify-between px-2 gap-2 sticky top-0 z-30 shrink-0">
              
              {/* Left: Logo & Room Selector */}
              <div className="flex items-center gap-2 shrink-0">
                   <div className="w-8 h-8 bg-gradient-to-br from-mirc-pink to-purple-500 rounded-lg flex items-center justify-center shrink-0">
                      <Command size={18} className="text-white" />
                   </div>
                   
                   {/* Room Dropdown */}
                   <div className="relative group">
                      <button className={`
                          flex items-center gap-2 px-3 py-1.5 rounded-l-full border-y border-l border-gray-600 text-xs md:text-sm transition-colors max-w-[120px] truncate
                          ${currentView.type === 'room' ? 'bg-mirc-cyan/10 border-mirc-cyan text-mirc-cyan font-bold' : 'bg-slate-900 text-gray-400 hover:text-white'}
                      `}>
                          <Hash size={14} />
                          <span className="truncate">{currentRoomObj?.name || 'Select Room'}</span>
                          <ChevronDown size={12} className="ml-1 opacity-50" />
                      </button>
                      {/* Room Menu */}
                      <div className="absolute top-full left-0 mt-1 w-48 bg-slate-800 border border-gray-600 rounded-lg shadow-xl hidden group-hover:block z-50">
                          {rooms.map(r => (
                              <button key={r.id} onClick={() => switchToRoom(r)} className="w-full text-left px-3 py-2 text-sm hover:bg-white/5 flex items-center gap-2 text-gray-300">
                                  <Hash size={12} /> {r.name} {activeRoomId === r.id && <Check size={12} className="ml-auto text-green-400" />}
                              </button>
                          ))}
                          {isModerator(currentUser) && <button onClick={createDefaultRoom} className="w-full text-left px-3 py-2 text-sm hover:bg-white/5 text-gray-400 border-t border-gray-700"><Plus size={12} className="inline mr-1"/> New Room</button>}
                      </div>
                   </div>
              </div>

              {/* Center: PM Tabs */}
              <div className="flex-1 flex items-center gap-1 overflow-x-auto scrollbar-hide mask-linear-fade">
                  {visiblePMs.map(user => {
                      const isActive = currentView.type === 'pm' && currentView.userId === user.id;
                      const isUnread = unreadPMs.has(user.id);
                      return (
                          <div 
                              key={user.id} 
                              onClick={() => switchToPM(user.id)}
                              className={`
                                  group relative flex items-center gap-2 px-3 py-1.5 rounded-t-lg border-t border-x border-gray-700 cursor-pointer min-w-[100px] max-w-[150px]
                                  ${isActive ? 'bg-slate-700 text-white border-b-slate-700 mb-[-1px] z-10' : 'bg-slate-900 text-gray-400 hover:bg-slate-800'}
                                  ${isUnread ? 'animate-flash font-bold' : ''}
                              `}
                          >
                              <div className="relative">
                                  <img src={user.avatar || DEFAULT_AVATAR} className="w-4 h-4 rounded-full" />
                                  <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-slate-900 ${user.isOnline ? 'bg-green-500' : 'bg-gray-500'}`} />
                              </div>
                              <span className="text-xs truncate flex-1">{user.username}</span>
                              <button 
                                  onClick={(e) => closePMTab(e, user.id)}
                                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-500 hover:text-white rounded-full transition-all"
                              >
                                  <X size={10} />
                              </button>
                          </div>
                      )
                  })}

                  {/* Overflow Menu */}
                  {overflowPMs.length > 0 && (
                      <div className="relative">
                          <button 
                              onClick={() => setShowTabOverflow(!showTabOverflow)}
                              className={`flex items-center gap-1 px-2 py-1.5 text-xs font-bold rounded ${unreadPMs.size > 0 ? 'text-mirc-pink animate-pulse' : 'text-gray-400 hover:text-white'}`}
                          >
                              <MessageCircle size={14} />
                              +{overflowPMs.length}
                          </button>
                          {showTabOverflow && (
                              <div className="absolute top-full right-0 mt-2 w-48 bg-slate-800 border border-gray-600 rounded-lg shadow-xl z-50">
                                  {overflowPMs.map(u => (
                                      <div key={u.id} onClick={() => switchToPM(u.id)} className="flex items-center justify-between px-3 py-2 hover:bg-white/5 cursor-pointer text-sm text-gray-300">
                                          <div className="flex items-center gap-2">
                                              <span className={`w-2 h-2 rounded-full ${unreadPMs.has(u.id) ? 'bg-mirc-pink animate-pulse' : 'bg-transparent'}`} />
                                              {u.username}
                                          </div>
                                          <button onClick={(e) => closePMTab(e, u.id)} className="text-gray-500 hover:text-red-400"><X size={12}/></button>
                                      </div>
                                  ))}
                              </div>
                          )}
                      </div>
                  )}
              </div>

              {/* Right: Music & Profile */}
              <div className="flex-1 flex justify-end items-center gap-2 shrink-0">
                  <div className="hidden md:block"><MusicPlayer /></div>
                  <button onClick={() => setShowMobileUserList(!showMobileUserList)} className="md:hidden p-2 text-gray-400"><Users size={20}/></button>
                  <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-red-400"><LogOut size={18}/></button>
              </div>
            </header>
            
            {/* PM PERMISSION ERROR BANNER */}
            {pmError && (
                 <div className="bg-red-900/90 text-white text-xs px-2 py-1 text-center border-b border-red-500 animate-in slide-in-from-top-2 flex items-center justify-center gap-2">
                     <AlertTriangle size={14} className="text-yellow-400" />
                     <span>
                        <b>Private Chat Error:</b> Access denied. Please set API Rules for <b>private_messages</b> (List/View/Create/Update) to: 
                        <code className="bg-black/30 px-1 rounded ml-1 select-all">sender = @request.auth.id || recipient = @request.auth.id</code>
                     </span>
                 </div>
            )}

            {/* MAIN CONTENT AREA */}
            <div className="flex flex-1 overflow-hidden relative">
              
              {/* Chat Area */}
              <div className="flex-1 flex flex-col bg-slate-900/50 relative min-w-0 min-h-0 w-full">
                  {/* Chat Header Info Bar */}
                  <div className="bg-slate-950/30 border-b border-gray-800 px-4 py-1 flex items-center justify-between text-xs text-gray-500 h-8 shrink-0">
                      {currentView.type === 'room' ? (
                          <span>Topic: {currentRoomObj?.topic || 'Welcome to the chat'} {currentRoomObj?.isMuted && <span className="text-red-400 ml-2 flex items-center gap-1 inline-flex"><LockKeyhole size={10}/> LOCKED</span>}</span>
                      ) : (
                          <div className="flex items-center gap-2 text-mirc-pink">
                              <span className="font-bold">PRIVATE CHAT</span>
                              <span className="text-gray-400">with {targetUserForHeader?.username}</span>
                          </div>
                      )}
                      {realtimeError && <span className="text-red-500 flex items-center gap-1"><WifiOff size={10}/> Reconnecting...</span>}
                  </div>

                  <MessageList 
                      messages={messagesToShow as Message[]} 
                      currentUser={currentUser} 
                      usersMap={usersMap} 
                      isPrivate={currentView.type === 'pm'}
                  />
                  
                  <ChatInput 
                      onSendMessage={handleSendMessage} 
                      allowAttachments={true} 
                      disabled={currentView.type === 'room' && currentRoomObj?.isMuted && !isModerator(currentUser)} 
                      isLocked={currentView.type === 'room' && currentRoomObj?.isMuted} 
                  />
              </div>

              {/* Sidebar (User List) */}
              <div className={`
                  fixed inset-y-0 right-0 z-40 bg-mirc-dark border-l border-gray-700 transition-transform duration-300 shadow-2xl md:shadow-none
                  ${showMobileUserList ? 'translate-x-0' : 'translate-x-full'}
                  md:relative md:translate-x-0 md:block md:static h-full
              `}>
                   <div className="md:hidden absolute top-2 right-2 z-50">
                      <button onClick={() => setShowMobileUserList(false)} className="p-1 text-gray-400 hover:text-white"><X size={18} /></button>
                  </div>
                  <UserList 
                      users={users} 
                      currentUserId={currentUser.id}
                      onOpenPrivateChat={handleOpenPrivateChat} 
                      currentUserRole={currentUser.role}
                      // Pass handlers mostly relevant for room moderation
                      onKick={handleKickUser}
                      onBan={handleBanUser}
                      onToggleOp={handleToggleOp}
                      onRefresh={fetchUsers}
                      permissionError={permissionError}
                  />
              </div>
            </div>
          </>
        )}
      </div>
    </MIRCProvider>
  );
};

export default CuteMIRC;