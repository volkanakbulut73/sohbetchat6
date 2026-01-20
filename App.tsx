import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { LogOut, Hash, Plus, Command, Bot, Users, Lock, Unlock, Loader2, Key } from 'lucide-react';

// Module Props Interface
export interface CuteMIRCProps {
    pocketbaseUrl: string;
    className?: string;
}

const CuteMIRC: React.FC<CuteMIRCProps> = ({ pocketbaseUrl, className }) => {
  // Initialize PocketBase Client for this instance
  const pb = useMemo(() => createPocketBaseClient(pocketbaseUrl), [pocketbaseUrl]);

  // --- State ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [usersMap, setUsersMap] = useState<Map<string, User>>(new Map());
  const [showMobileUserList, setShowMobileUserList] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Login & API Key State
  const [usernameInput, setUsernameInput] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [showKeySelector, setShowKeySelector] = useState(false);
  
  // Private Chats
  const [activePMs, setActivePMs] = useState<User[]>([]);
  const [privateMessages, setPrivateMessages] = useState<Record<string, PrivateMessage[]>>({});

  // --- Helpers ---
  const isModerator = (user: User | null) => user?.role === UserRole.ADMIN || user?.role === UserRole.OPERATOR;
  const isAdmin = (user: User | null) => user?.role === UserRole.ADMIN;

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
        // Fetch all users
        fetchedUsers = await pb.collection('users').getFullList<User>({ sort: 'username', requestKey: null });
    } catch(e: any) { 
        if (e?.message !== "The current and the previous request authorization don't match.") {
            console.log("Fetch users error", e.message); 
        }
    }

    // GHOST BUSTING LOGIC:
    // If a user says they are "Online" but hasn't updated their profile in 2 minutes, mark them offline locally.
    const now = new Date();
    const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000);

    const processedUsers = fetchedUsers.map(u => {
        // If user is 'online' but updated timestamp is old, force offline visual
        // PocketBase 'updated' field is ISO string
        const lastUpdate = new Date(u.updated); // assuming 'updated' field exists
        const isGhost = u.isOnline && lastUpdate < twoMinutesAgo;
        
        // Don't mark current user as ghost
        if (pb.authStore.isValid && u.id === pb.authStore.model?.id) {
            return { ...u, isOnline: true };
        }

        return isGhost ? { ...u, isOnline: false } : u;
    });

    // Ensure Current User is in list
    if (pb.authStore.isValid && pb.authStore.model) {
            const myId = pb.authStore.model.id;
            const myUserIndex = processedUsers.findIndex(u => u.id === myId);
            
            if (myUserIndex === -1) {
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
  // Ping the server every 30 seconds to say "I am alive"
  useEffect(() => {
    if (!currentUser) return;

    const heartbeat = async () => {
        try {
            // Updating any field refreshes the 'updated' timestamp
            await pb.collection('users').update(currentUser.id, { isOnline: true });
        } catch (e) {
            console.warn("Heartbeat failed", e);
        }
    };

    const intervalId = setInterval(heartbeat, 30000); // 30 seconds
    return () => clearInterval(intervalId);
  }, [currentUser, pb]);


  // --- Effects ---

  // 1. Initial Load
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

      try {
        const roomsList = await pb.collection('rooms').getFullList<Room>({ sort: 'created' });
        setRooms(roomsList);
        
        if (roomsList.length > 0) {
            setCurrentRoom(roomsList[0]);
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
    init();
  }, [pb]);

  // 2. Room Subscription
  useEffect(() => {
    if (!currentRoom) return;

    const fetchMessages = async () => {
      try {
          const msgs = await pb.collection('messages').getList<Message>(1, 50, {
            filter: `room="${currentRoom.id}"`,
            sort: '-created',
            expand: 'user',
          });
          setMessages(msgs.items.reverse());
      } catch (e) { console.error("Error loading messages", e); }
    };
    fetchMessages();

    const initSub = async () => {
        try {
            await pb.collection('messages').subscribe('*', function (e) {
                if (e.action === 'create' && e.record.room === currentRoom.id) {
                    const newMsg = e.record as unknown as Message;
                    setMessages((prev) => [...prev, newMsg]);
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
        try {
            pb.collection('messages').unsubscribe('*'); 
            pb.collection('rooms').unsubscribe('*');
        } catch(_) {}
    };
  }, [currentRoom?.id, pb]);

  // 3. User Presence Subscription
  useEffect(() => {
    fetchUsers();
    
    // Refresh user list every 60 seconds regardless of events to clear ghosts
    const ghostInterval = setInterval(fetchUsers, 60000);

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
                        return;
                    }
                    if (updatedUser.isOnline === false) {
                        // We check "updated" in fetchUsers, so we don't need to auto-logout on simple isOnline changes
                        // unless explicitly set to false by admin logic (kick).
                        // Since heartbeat sets isOnline=true constantly, a kick would set it false.
                        // We rely on visual cue or explicit message for kick, but let's keep it safe:
                        // handleLogout(); 
                        // Note: Removing auto-logout on isOnline:false because heartbeat might race.
                        // Let the Kick action handle the logout via a separate mechanism or message.
                    }
                    setCurrentUser(prev => {
                        if (prev && prev.role !== updatedUser.role) {
                            return { ...prev, role: updatedUser.role };
                        }
                        return prev;
                    });
                }
            });
        } catch (err) {}
    };
    initUserSub();

    return () => { 
        try {
            pb.collection('users').unsubscribe('*'); 
            clearInterval(ghostInterval);
        } catch(_) {}
    };
  }, [fetchUsers, pb]);

  // 4. Auto Clear Msgs
  useEffect(() => {
    const intervalId = setInterval(() => {
        setMessages([]); 
    }, 10 * 60 * 1000);
    return () => clearInterval(intervalId);
  }, []);

  // --- Handlers ---

  const handleLogin = async () => {
    if (!usernameInput || isLoading) return;
    setIsLoading(true);

    try {
        const password = 'password123';
        
        try {
            await pb.collection('users').create({
                username: usernameInput,
                password: password,
                passwordConfirm: password,
                role: 'user',
                isOnline: true,
                banned: false
            });
        } catch (createError) {}
        
        try {
            await pb.collection('users').authWithPassword(usernameInput, password);
        } catch (authError: any) {
             alert("Login failed: Username taken or error.");
             setIsLoading(false);
             return;
        }
        
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
            
            await fetchUsers();

             const roomsList = await pb.collection('rooms').getFullList<Room>();
             if (roomsList.length === 0) {
                 try {
                    const newRoom = await pb.collection('rooms').create({ name: 'General', topic: 'The lobby', isMuted: false }) as unknown as Room;
                    setRooms([newRoom]);
                    setCurrentRoom(newRoom);
                 } catch {}
             } else {
                 setRooms(roomsList);
                 if(!currentRoom) setCurrentRoom(roomsList[0]);
             }
        }
    } catch (e: any) {
        console.error("Login error:", e);
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
      setMessages([]);
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
        await pb.collection('messages').create({
            text: text,
            user: currentUser.id,
            room: currentRoom.id
        });

        const lowerText = text.toLowerCase();
        const shouldTriggerBot = lowerText.includes('gemini') || lowerText.includes('@bot') || lowerText.includes('@ai');
        
        if (shouldTriggerBot) {
             const history = messages.slice(-5).map(m => `${usersMap.get(m.user)?.username || 'User'}: ${m.text}`);
             try {
                const botResponse = await generateBotResponse(text, history);
                const botMsg: Message = {
                    id: Math.random().toString(),
                    collectionId: 'messages',
                    collectionName: 'messages',
                    created: new Date().toISOString(),
                    updated: new Date().toISOString(),
                    text: botResponse,
                    user: 'bot_ai',
                    room: currentRoom.id,
                    type: 'text'
                };
                setMessages(prev => [...prev, botMsg]);
             } catch (botError) {}
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
              <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl border border-mirc-pink/30 w-96 text-center">
                  <div className="mb-6 flex justify-center">
                      <div className="bg-mirc-pink p-4 rounded-full shadow-[0_0_20px_#f472b6]">
                          <Bot size={48} className="text-white" />
                      </div>
                  </div>
                  <h1 className="text-2xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-mirc-pink to-mirc-purple">WorkigomChat AI</h1>
                  <p className="text-sm text-gray-400 mb-6 font-mono">Enter the retro-future chat.</p>
                  
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

                  <div className="relative">
                      <input 
                          type="text" 
                          placeholder="Choose a Nickname"
                          className="w-full p-3 bg-slate-900 border border-slate-700 rounded-lg mb-4 text-white focus:border-mirc-pink outline-none transition-colors font-mono"
                          value={usernameInput}
                          onChange={(e) => setUsernameInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                          disabled={isLoading}
                      />
                  </div>
                  <button 
                      onClick={handleLogin}
                      disabled={isLoading}
                      className="w-full bg-gradient-to-r from-mirc-pink to-purple-600 text-white font-bold py-3 rounded-lg hover:shadow-lg hover:scale-[1.02] transition-transform flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                      {isLoading ? <Loader2 className="animate-spin" size={20} /> : "Connect"}
                  </button>
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

              <div className="mx-1 shrink-0">
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
                              messages={messages} 
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