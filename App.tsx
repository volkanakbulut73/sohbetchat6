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
import PrivateChatWindow from './components/PrivateChatWindow';
import { LogOut, Hash, Plus, Command, Bot, Users, Lock, Unlock, Loader2, Key, Mail, User as UserIcon, LockKeyhole } from 'lucide-react';

export interface CuteMIRCProps {
    pocketbaseUrl: string;
    className?: string;
}

const CuteMIRC: React.FC<CuteMIRCProps> = ({ pocketbaseUrl, className }) => {
  const pb = useMemo(() => createPocketBaseClient(pocketbaseUrl), [pocketbaseUrl]);

  // --- State ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  
  // Split messages into DB (persistent) and Local (Bot/System) to prevent re-fetches from wiping Bot msgs
  const [dbMessages, setDbMessages] = useState<Message[]>([]);
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  
  const [users, setUsers] = useState<User[]>([]);
  const [usersMap, setUsersMap] = useState<Map<string, User>>(new Map());
  const [showMobileUserList, setShowMobileUserList] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Login & Register State
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState(''); // Used for registration
  
  // API Key State
  const [hasApiKey, setHasApiKey] = useState(false);
  const [showKeySelector, setShowKeySelector] = useState(false);
  
  // Private Chats
  const [activePMs, setActivePMs] = useState<User[]>([]);
  const [privateMessages, setPrivateMessages] = useState<Record<string, PrivateMessage[]>>({});

  // --- Refs ---
  // We use refs to access the latest state inside subscription callbacks 
  // without triggering re-renders or resetting subscriptions unnecessarily.
  const usersMapRef = useRef(usersMap);
  const currentUserRef = useRef(currentUser);
  
  // Fix for disappearing bot messages: Track the last loaded room ID
  const lastRoomIdRef = useRef<string | null>(null);

  useEffect(() => { usersMapRef.current = usersMap; }, [usersMap]);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);

  // --- Helpers ---
  const isModerator = (user: User | null) => user?.role === UserRole.ADMIN || user?.role === UserRole.OPERATOR;
  const isAdmin = (user: User | null) => user?.role === UserRole.ADMIN;

  // Combine DB and Local messages for display
  const allMessages = useMemo(() => {
      // Merge and sort by creation time
      const combined = [...dbMessages, ...localMessages];
      return combined.sort((a, b) => new Date(a.created).getTime() - new Date(b.created).getTime());
  }, [dbMessages, localMessages]);

  // --- Check for API Key ---
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

  // --- Core Data Fetching ---
  
  const fetchUsers = useCallback(async () => {
    // Only fetch if logged in to avoid 403s on login screen
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
        fetchedUsers = await pb.collection('users').getFullList<User>({ sort: 'username', requestKey: null });
    } catch(e: any) { 
        // Silent fail
    }

    const processedUsers = fetchedUsers.map(u => {
        if (pb.authStore.isValid && u.id === pb.authStore.model?.id) {
            return { ...u, isOnline: true };
        }
        return u;
    });

    if (pb.authStore.isValid && pb.authStore.model) {
        const myId = pb.authStore.model.id;
        if (!processedUsers.find(u => u.id === myId)) {
            const me: User = {
                id: myId,
                username: pb.authStore.model.username,
                role: (pb.authStore.model.role as UserRole) || UserRole.USER,
                isOnline: true,
                avatar: pb.authStore.model.avatar ? pb.files.getUrl(pb.authStore.model, pb.authStore.model.avatar) : undefined,
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

  // --- HEARTBEAT SYSTEM ---
  useEffect(() => {
    if (!currentUser) return;

    const heartbeat = async () => {
        try {
            await pb.collection('users').update(currentUser.id, { isOnline: true });
        } catch (e) {
            // Heartbeat failed
        }
    };
    
    // Send immediately on login/mount
    heartbeat();

    const intervalId = setInterval(heartbeat, 30000); 
    return () => clearInterval(intervalId);
  }, [currentUser, pb]);


  // --- Effects ---

  // 1. Initial Load (Auth Check)
  useEffect(() => {
    const init = async () => {
      if (pb.authStore.isValid && pb.authStore.model) {
        try {
            const freshMe = await pb.collection('users').getOne(pb.authStore.model.id);
            if (freshMe.banned) {
                alert("You are banned from this server.");
                pb.authStore.clear();
                return;
            }
            const user = {
                id: freshMe.id,
                username: freshMe.username,
                avatar: freshMe.avatar ? pb.files.getUrl(freshMe, freshMe.avatar) : undefined,
                role: (freshMe.role as UserRole) || UserRole.USER,
                isOnline: true,
                created: freshMe.created,
                updated: freshMe.updated
            } as User;
            setCurrentUser(user);
        } catch (e) {
            pb.authStore.clear();
        }
      }
    };
    init();
  }, [pb]);

  // 1.5 Fetch Rooms (Only if logged in)
  useEffect(() => {
      if (!currentUser) return; // Don't fetch rooms if not logged in

      const loadRooms = async () => {
        try {
            const roomsList = await pb.collection('rooms').getFullList<Room>({ sort: 'created' });
            setRooms(roomsList);
            
            if (roomsList.length > 0) {
                // Only set current room if not already set, to prevent jumping
                setCurrentRoom(prev => prev || roomsList[0]);
            } else if (pb.authStore.isValid) {
                try {
                    const newRoom = await pb.collection('rooms').create({
                        name: 'General',
                        topic: 'The lobby',
                        isMuted: false
                    }) as unknown as Room;
                    setRooms([newRoom]);
                    setCurrentRoom(newRoom);
                } catch (err) {}
            }
        } catch (e) { console.error("Error fetching rooms", e); }
      };
      loadRooms();
  }, [pb, currentUser]);

  // 2. Room Subscription & Message Fetching
  useEffect(() => {
    if (!currentRoom || !currentUser) return; // Stop if no room OR no user
    
    // Critical Fix: Only clear messages if the ROOM actually changed.
    // This prevents clearing Bot messages when other effects run.
    if (lastRoomIdRef.current !== currentRoom.id) {
        setLocalMessages([]);
        setDbMessages([]); // Optional: Clear DB messages while loading new ones for cleaner switch
        lastRoomIdRef.current = currentRoom.id;
    }

    const fetchMessages = async () => {
      try {
          const msgs = await pb.collection('messages').getList<Message>(1, 50, {
            filter: `room="${currentRoom.id}"`,
            sort: '-created',
            expand: 'user',
          });
          setDbMessages(msgs.items.reverse());
      } catch (e) { console.error("Error loading messages", e); }
    };
    fetchMessages();

    const initSub = async () => {
        try {
            await pb.collection('messages').subscribe('*', function (e) {
                if (e.action === 'create' && e.record.room === currentRoom.id) {
                    const newMsg = e.record as unknown as Message;
                    // Use ref to get latest users map without re-running effect
                    if (!newMsg.expand?.user && newMsg.user) {
                        newMsg.expand = { user: usersMapRef.current.get(newMsg.user) };
                    }
                    setDbMessages((prev) => [...prev, newMsg]);
                }
            });
            await pb.collection('rooms').subscribe(currentRoom.id, function (e) {
                if (e.action === 'update') {
                    setCurrentRoom(e.record as unknown as Room);
                }
            });
        } catch (err) {}
    };
    initSub();

    return () => { 
        const cleanup = async () => {
            try {
                await pb.collection('messages').unsubscribe('*'); 
                await pb.collection('rooms').unsubscribe('*');
            } catch(_) {}
        };
        cleanup();
    };
  }, [currentRoom?.id, pb]); 

  // 3. User Presence Subscription
  useEffect(() => {
    if (!currentUser) return; // Only fetch users if logged in

    fetchUsers();
    const refreshInterval = setInterval(fetchUsers, 10000);

    const initUserSub = async () => {
        try {
            await pb.collection('users').subscribe('*', (e) => {
                fetchUsers();
                
                const myId = pb.authStore.model?.id;
                if (myId && e.record.id === myId && e.action === 'update') {
                    const updatedUser = e.record as unknown as User;
                     if (updatedUser.banned) {
                        alert("You have been BANNED from the server.");
                        handleLogout();
                    }
                }
            });
        } catch (err) {}
    };
    initUserSub();

    return () => { 
        const cleanup = async () => {
            try {
               await pb.collection('users').unsubscribe('*'); 
            } catch (_) {}
        };
        cleanup();
        clearInterval(refreshInterval);
    };
  }, [fetchUsers, pb, currentUser]);

  // 4. Auto Clear Msgs
  useEffect(() => {
    const intervalId = setInterval(() => {
        // Only clear DB messages periodically to save memory, 
        // but maybe we shouldn't wipe Local messages aggressively?
        // Let's just clear DB messages to be safe.
        setDbMessages([]); 
        // We'll keep local bot messages a bit longer or let user clear them manually by room switch
    }, 20 * 60 * 1000);
    return () => clearInterval(intervalId);
  }, []);

  // --- Handlers ---

  const handleAuth = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!email || !password || (authMode === 'register' && !username)) return;
    
    setIsLoading(true);

    try {
        if (authMode === 'register') {
            // Register Flow
            try {
                // Create user
                await pb.collection('users').create({
                    username: username,
                    email: email,
                    password: password,
                    passwordConfirm: password,
                    emailVisibility: true,
                    role: 'user',
                    isOnline: true,
                    banned: false
                });
                
                // If create successful, immediately login
                await pb.collection('users').authWithPassword(email, password);
            } catch (err: any) {
                console.error("Registration failed:", err);
                let errorMsg = "Registration failed. ";
                if (err.status === 400) errorMsg += "Username or Email might be taken.";
                else if (err.status === 403) errorMsg += "Public registration is disabled in PocketBase settings.";
                else errorMsg += err.message;
                alert(errorMsg);
                setIsLoading(false);
                return;
            }
        } else {
            // Login Flow
            try {
                await pb.collection('users').authWithPassword(email, password);
            } catch (err: any) {
                console.error("Login failed:", err);
                alert("Login failed. Check your email/username and password.");
                setIsLoading(false);
                return;
            }
        }

        // Post-Login Logic (Same for both paths)
        const model = pb.authStore.model;
        if (model) {
            if (model.banned) {
                alert("This account is banned.");
                pb.authStore.clear();
                setIsLoading(false);
                return;
            }

            try {
                await pb.collection('users').update(model.id, { isOnline: true });
            } catch (e) {}

            setCurrentUser({
                id: model.id,
                username: model.username,
                role: model.role as UserRole,
                isOnline: true,
                created: model.created,
                updated: model.updated,
                avatar: model.avatar ? pb.files.getUrl(model, model.avatar) : undefined
            });
            // Reset forms
            setPassword('');
        }
    } catch (e: any) {
        console.error("Auth process error:", e);
        alert("Authentication error.");
    } finally {
        setIsLoading(false);
    }
  };

  const handleLogout = async () => {
      if (currentUser) {
          try {
              pb.collection('users').update(currentUser.id, { isOnline: false });
          } catch (e) {}
      }
      pb.authStore.clear();
      setDbMessages([]);
      setLocalMessages([]);
      setRooms([]);
      setCurrentRoom(null);
      setCurrentUser(null);
  };

  const createDefaultRoom = async () => {
      if (!isModerator(currentUser)) return; 
      try {
        const newRoom = await pb.collection('rooms').create({ name: 'New Room', topic: 'New Topic', isMuted: false }) as unknown as Room;
        setRooms(prev => [...prev, newRoom]);
        setCurrentRoom(newRoom);
      } catch (e) { console.error(e); }
  }

  const handleSendMessage = async (text: string, file?: File) => {
    if (!currentUser || !currentRoom) return;
    if (!text.trim()) return;

    if (currentRoom.isMuted && !isModerator(currentUser)) {
        alert("Room is locked.");
        return;
    }

    if (text.startsWith('/nick ')) {
        const newNick = text.substring(6);
        await pb.collection('users').update(currentUser.id, { username: newNick });
        return;
    }

    try {
        // 1. Send user message to DB
        await pb.collection('messages').create({
            text: text,
            user: currentUser.id,
            room: currentRoom.id
        });

        // 2. Check for Bot Trigger
        const lowerText = text.toLowerCase();
        const shouldTriggerBot = lowerText.includes('gemini') || lowerText.includes('@bot') || lowerText.includes('@ai');
        
        if (shouldTriggerBot) {
             const history = allMessages.slice(-5).map(m => `${usersMapRef.current.get(m.user)?.username || 'User'}: ${m.text}`);
             try {
                // Generate
                const botResponse = await generateBotResponse(text, history);
                
                // Create Bot Message Object
                const botMsg: Message = {
                    id: Math.random().toString(), // Temp ID
                    collectionId: 'messages',
                    collectionName: 'messages',
                    created: new Date().toISOString(),
                    updated: new Date().toISOString(),
                    text: botResponse,
                    user: 'bot_ai', // Matches Bot User in list
                    room: currentRoom.id,
                    type: 'text'
                };

                // 3. Save to LOCAL state only (persistent against DB refreshes)
                setLocalMessages(prev => [...prev, botMsg]);
             } catch (botError) {
                 console.error(botError);
             }
        }
    } catch (e) {}
  };

  const handleToggleRoomLock = async () => {
      if (!currentRoom || !isModerator(currentUser)) return;
      try {
          await pb.collection('rooms').update(currentRoom.id, { isMuted: !currentRoom.isMuted });
      } catch (e) {}
  };

  const handleKickUser = async (userToKick: User) => {
    if (!isModerator(currentUser)) return;
    if (userToKick.role === UserRole.ADMIN) return;
    try {
        await pb.collection('users').update(userToKick.id, { isOnline: false });
        await pb.collection('messages').create({
            text: `*** ${userToKick.username} was kicked by ${currentUser!.username}`,
            user: currentUser!.id,
            room: currentRoom!.id,
            type: 'text'
        });
    } catch (e) {}
  };

  const handleBanUser = async (userToBan: User) => {
    if (!isAdmin(currentUser)) return;
    if (userToBan.role === UserRole.ADMIN) return;

    try {
        const newBanStatus = !userToBan.banned;
        await pb.collection('users').update(userToBan.id, { 
            banned: newBanStatus,
            isOnline: newBanStatus ? false : userToBan.isOnline 
        });
        await pb.collection('messages').create({
            text: newBanStatus ? `*** ${userToBan.username} was BANNED` : `*** ${userToBan.username} was unbanned`,
            user: currentUser!.id,
            room: currentRoom!.id,
            type: 'text'
        });
    } catch (e) {}
  };

  const handleToggleOp = async (userToOp: User) => {
    if (!isAdmin(currentUser)) return;
    if (userToOp.role === UserRole.ADMIN) return;

    try {
        const newRole = userToOp.role === UserRole.OPERATOR ? UserRole.USER : UserRole.OPERATOR;
        await pb.collection('users').update(userToOp.id, { role: newRole });
        await pb.collection('messages').create({
            text: `*** ${userToOp.username} role changed`,
            user: currentUser!.id,
            room: currentRoom!.id,
            type: 'text'
        });
    } catch (e) {}
  };

  const handleOpenPrivateChat = (user: User) => {
      if (user.id === currentUser?.id) return;
      if (!activePMs.find(u => u.id === user.id)) {
          setActivePMs(prev => [...prev, user]);
      }
      setShowMobileUserList(false);
  };

  const handleClosePM = (userId: string) => {
      setActivePMs(prev => prev.filter(u => u.id !== userId));
  };

  const handleSendPM = (recipientId: string, text: string, file?: File) => {
      const newMsg: PrivateMessage = {
          id: Math.random().toString(),
          text: text || (file ? '[Attachment Sent]' : ''),
          sender: currentUser!.id,
          recipient: recipientId,
          created: new Date().toISOString(),
          attachment: file ? URL.createObjectURL(file) : undefined,
          type: file ? 'image' : 'text'
      };
      setPrivateMessages(prev => ({
          ...prev,
          [recipientId]: [...(prev[recipientId] || []), newMsg]
      }));
  };

  return (
    <MIRCProvider pb={pb}>
      <div className={`flex flex-col h-[100dvh] w-full bg-mirc-darker text-gray-200 overflow-hidden ${className || ''}`}>
        {!currentUser ? (
          <div className="flex items-center justify-center h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
              <div className="bg-slate-800 p-6 md:p-8 rounded-2xl shadow-2xl border border-mirc-pink/30 w-[90%] md:w-96 text-center animate-in fade-in zoom-in duration-300">
                  <div className="mb-6 flex justify-center">
                      <div className="bg-mirc-pink p-4 rounded-full shadow-[0_0_20px_#f472b6]">
                          <Bot size={48} className="text-white" />
                      </div>
                  </div>
                  <h1 className="text-2xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-mirc-pink to-mirc-purple">WorkigomChat AI</h1>
                  <p className="text-sm text-gray-400 mb-6 font-mono">
                      {authMode === 'login' ? 'Login to continue' : 'Join the retro future'}
                  </p>
                  
                  {!hasApiKey && (
                      <div className="mb-6 p-3 bg-red-900/30 border border-red-500/50 rounded text-xs text-red-200">
                          <p className="mb-2 font-bold flex items-center justify-center gap-1">⚠️ API Key Missing</p>
                          {showKeySelector ? (
                              <button 
                                onClick={handleSelectKey}
                                className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded flex items-center justify-center gap-2"
                              >
                                  <Key size={14} /> Select API Key
                              </button>
                          ) : (
                              <p className="opacity-80">Please add VITE_API_KEY</p>
                          )}
                      </div>
                  )}

                  <form onSubmit={handleAuth} className="space-y-4">
                      {/* Register: Username Field */}
                      {authMode === 'register' && (
                          <div className="relative group">
                             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500 group-focus-within:text-mirc-cyan transition-colors">
                                  <UserIcon size={18} />
                             </div>
                             <input 
                                  type="text" 
                                  placeholder="Username (Nick)"
                                  className="w-full pl-10 p-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-mirc-pink outline-none transition-colors font-mono"
                                  value={username}
                                  onChange={(e) => setUsername(e.target.value)}
                                  disabled={isLoading}
                                  required
                              />
                          </div>
                      )}

                      {/* Login/Register: Email Field */}
                      <div className="relative group">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500 group-focus-within:text-mirc-cyan transition-colors">
                              <Mail size={18} />
                          </div>
                          <input 
                              type="text" 
                              placeholder={authMode === 'login' ? "Email or Username" : "Email Address"}
                              className="w-full pl-10 p-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-mirc-pink outline-none transition-colors font-mono"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              disabled={isLoading}
                              required
                          />
                      </div>

                      {/* Login/Register: Password Field */}
                      <div className="relative group">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500 group-focus-within:text-mirc-cyan transition-colors">
                              <LockKeyhole size={18} />
                          </div>
                          <input 
                              type="password" 
                              placeholder="Password"
                              className="w-full pl-10 p-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-mirc-pink outline-none transition-colors font-mono"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
                              disabled={isLoading}
                              required
                              minLength={5}
                          />
                      </div>

                      <button 
                          type="submit"
                          disabled={isLoading}
                          className="w-full bg-gradient-to-r from-mirc-pink to-purple-600 text-white font-bold py-3 rounded-lg hover:shadow-[0_0_15px_rgba(244,114,182,0.4)] hover:scale-[1.02] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                          {isLoading ? <Loader2 className="animate-spin" size={20} /> : (authMode === 'login' ? "Connect" : "Register")}
                      </button>
                  </form>
                  
                  <div className="mt-4 text-xs text-gray-400">
                      {authMode === 'login' ? (
                          <p>
                              New here? <button onClick={() => setAuthMode('register')} className="text-mirc-cyan hover:underline font-bold">Create Account</button>
                          </p>
                      ) : (
                          <p>
                              Already have an account? <button onClick={() => setAuthMode('login')} className="text-mirc-cyan hover:underline font-bold">Login</button>
                          </p>
                      )}
                  </div>
              </div>
          </div>
        ) : (
          <>
            <header className="h-16 bg-slate-800/80 backdrop-blur-md border-b border-gray-700 flex items-center justify-between px-2 md:px-4 sticky top-0 z-10 shrink-0">
              <div className="flex items-center gap-2 md:gap-4 flex-1 overflow-hidden">
                  <div className="flex items-center gap-2 shrink-0">
                      <div className="w-8 h-8 bg-gradient-to-br from-mirc-pink to-purple-500 rounded-lg flex items-center justify-center shrink-0">
                          <Command size={18} className="text-white" />
                      </div>
                      <span className="font-bold text-lg hidden md:block">WorkigomChat AI</span>
                  </div>
                  
                  <div className="relative group shrink-0 flex items-center gap-2">
                      <button className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-full border border-gray-600 text-xs md:text-sm hover:border-mirc-cyan transition-colors truncate max-w-[100px] md:max-w-none">
                          <Hash size={14} className="text-gray-400" />
                          <span className="font-mono text-mirc-cyan truncate">{currentRoom?.name || 'Select'}</span>
                      </button>
                      <div className="absolute top-full left-0 mt-2 w-48 bg-slate-800 border border-gray-600 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all transform origin-top-left z-20">
                          <div className="p-1">
                              {rooms.map(room => (
                                  <button 
                                      key={room.id}
                                      onClick={() => setCurrentRoom(room)}
                                      className={`w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2 ${currentRoom?.id === room.id ? 'bg-mirc-pink text-white' : 'text-gray-300 hover:bg-white/5'}`}
                                  >
                                      <Hash size={12} /> {room.name}
                                      {room.isMuted && <Lock size={10} className="text-red-400 ml-auto" />}
                                  </button>
                              ))}
                              {isModerator(currentUser) && (
                                  <>
                                      <div className="h-px bg-gray-700 my-1"></div>
                                      <button className="w-full text-left px-3 py-2 rounded text-sm text-gray-400 hover:text-white flex items-center gap-2" onClick={createDefaultRoom}>
                                          <Plus size={12} /> Create Room
                                      </button>
                                  </>
                              )}
                          </div>
                      </div>
                      
                      {isModerator(currentUser) && currentRoom && (
                          <button 
                              onClick={handleToggleRoomLock}
                              className={`p-1.5 rounded-full border transition-all ${currentRoom.isMuted ? 'bg-red-500/20 border-red-500 text-red-400' : 'border-gray-600 text-gray-400 hover:text-white'}`}
                              title={currentRoom.isMuted ? "Unlock Room" : "Lock Room"}
                          >
                              {currentRoom.isMuted ? <Lock size={14} /> : <Unlock size={14} />}
                          </button>
                      )}
                  </div>
              </div>

              <div className="mx-1 shrink-0 hidden md:block">
                  <MusicPlayer />
              </div>

              <div className="flex items-center gap-2 md:gap-3 shrink-0">
                  <button 
                      onClick={() => setShowMobileUserList(!showMobileUserList)}
                      className={`md:hidden p-2 rounded-lg transition-colors ${showMobileUserList ? 'bg-mirc-pink text-white' : 'text-gray-400 hover:text-white'}`}
                  >
                      <Users size={20} />
                  </button>

                  <div className="flex flex-col items-end mr-1 hidden sm:flex">
                      <span className="text-sm font-bold text-gray-200">{currentUser.username}</span>
                      <div className="flex items-center gap-1">
                          {currentUser.role === UserRole.ADMIN && <span className="text-[9px] bg-yellow-500/20 text-yellow-400 px-1 rounded border border-yellow-500/50">ADMIN</span>}
                          {currentUser.role === UserRole.OPERATOR && <span className="text-[9px] bg-blue-500/20 text-blue-400 px-1 rounded border border-blue-500/50">OP</span>}
                          <span className="text-[10px] text-green-400 font-mono">ONLINE</span>
                      </div>
                  </div>
                  <img src={currentUser.avatar || DEFAULT_AVATAR} className="w-8 h-8 md:w-9 md:h-9 rounded-full border border-gray-500" alt="me" />
                  <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-red-400" title="Logout">
                      <LogOut size={18} />
                  </button>
              </div>
            </header>

            <div className="flex flex-1 overflow-hidden relative">
              <div className="flex-1 flex flex-col bg-slate-900/50 relative min-w-0 min-h-0 w-full">
                  {currentRoom ? (
                      <>
                          <MessageList 
                              messages={allMessages} 
                              currentUser={currentUser} 
                              usersMap={usersMap}
                          />
                          <ChatInput 
                              onSendMessage={handleSendMessage} 
                              allowAttachments={false}
                              disabled={currentRoom.isMuted && !isModerator(currentUser)}
                              isLocked={currentRoom.isMuted}
                          />
                      </>
                  ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-gray-500 gap-4">
                          <Hash size={48} className="opacity-20" />
                          <p>No active channel.</p>
                      </div>
                  )}
              </div>

              <div className={`
                  fixed inset-y-0 right-0 z-40 bg-mirc-dark border-l border-gray-700 transition-transform duration-300 shadow-2xl md:shadow-none
                  ${showMobileUserList ? 'translate-x-0' : 'translate-x-full'}
                  md:relative md:translate-x-0 md:block md:static h-full
              `}>
                  <div className="md:hidden absolute top-2 right-2 z-50">
                      <button onClick={() => setShowMobileUserList(false)} className="p-1 text-gray-400 hover:text-white">
                          <Users size={18} />
                      </button>
                  </div>
                  <UserList 
                      users={users} 
                      currentUserId={currentUser.id}
                      onOpenPrivateChat={handleOpenPrivateChat} 
                      currentUserRole={currentUser.role}
                      onKick={handleKickUser}
                      onBan={handleBanUser}
                      onToggleOp={handleToggleOp}
                  />
              </div>

              <div className="absolute bottom-0 right-0 md:right-72 flex flex-col md:flex-row-reverse items-end gap-2 pointer-events-none z-30 pr-2 md:pr-4 pb-0 max-h-[50%] md:max-h-none">
                  {activePMs.map(user => (
                      <div key={user.id} className="pointer-events-auto">
                          <PrivateChatWindow 
                              recipient={user} 
                              currentUser={currentUser}
                              messages={privateMessages[user.id] || []}
                              onClose={() => handleClosePM(user.id)}
                              onSendMessage={(text, file) => handleSendPM(user.id, text, file)}
                          />
                      </div>
                  ))}
              </div>
            </div>
          </>
        )}
      </div>
    </MIRCProvider>
  );
};

export default CuteMIRC;