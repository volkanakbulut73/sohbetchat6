import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { Shield, Star, Bot, MessageCircle, Ban, UserMinus, Lock, Circle } from 'lucide-react';

interface UserListProps {
  users: User[];
  onOpenPrivateChat: (user: User) => void;
  currentUserRole: UserRole;
  onKick?: (user: User) => void;
  onBan?: (user: User) => void;
  onToggleOp?: (user: User) => void;
}

const UserList: React.FC<UserListProps> = ({ 
    users, 
    onOpenPrivateChat, 
    currentUserRole,
    onKick,
    onBan,
    onToggleOp
}) => {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; user: User | null } | null>(null);

  const handleContextMenu = (e: React.MouseEvent, user: User) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, user });
  };

  const closeMenu = () => setContextMenu(null);

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case UserRole.ADMIN: return <Star size={12} className="text-yellow-400" />;
      case UserRole.OPERATOR: return <Shield size={12} className="text-blue-400" />;
      case UserRole.BOT: return <Bot size={12} className="text-mirc-pink" />;
      default: return null; 
    }
  };

  const getRoleColor = (user: User) => {
    if (user.banned) return "text-red-500 line-through decoration-2";
    if (!user.isOnline && user.role !== UserRole.BOT) return "text-gray-500"; 

    switch (user.role) {
      case UserRole.ADMIN: return "text-yellow-400 font-bold shadow-yellow-400/20";
      case UserRole.OPERATOR: return "text-blue-400 font-semibold";
      case UserRole.BOT: return "text-mirc-pink font-mono";
      default: return "text-gray-300";
    }
  }

  // Sort: Admin > Op > Bot > Online > Offline > Name
  const sortedUsers = [...users].sort((a, b) => {
      const roles = { [UserRole.ADMIN]: 0, [UserRole.OPERATOR]: 1, [UserRole.BOT]: 2, [UserRole.USER]: 3 };
      if (roles[a.role] !== roles[b.role]) return roles[a.role] - roles[b.role];
      if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
      return a.username.localeCompare(b.username);
  });

  const onlineCount = users.filter(u => u.isOnline || u.role === UserRole.BOT).length;
  const canKick = currentUserRole === UserRole.ADMIN || currentUserRole === UserRole.OPERATOR;
  const canBan = currentUserRole === UserRole.ADMIN;
  const canOp = currentUserRole === UserRole.ADMIN;

  return (
    <div className="w-48 md:w-64 bg-mirc-dark border-l border-gray-700 flex flex-col h-full overflow-hidden" onClick={closeMenu}>
      <div className="p-2 md:p-3 border-b border-gray-700 bg-mirc-darker/50 mt-8 md:mt-0">
        <h3 className="font-bold text-gray-400 text-[10px] md:text-xs uppercase tracking-widest flex items-center justify-between">
           <span>Users</span>
           <span className="bg-slate-800 px-1.5 py-0.5 rounded text-mirc-cyan">{onlineCount}/{users.length}</span>
        </h3>
      </div>
      
      <div className="flex-1 overflow-y-auto p-1 md:p-2 space-y-0.5">
        {sortedUsers.map((user) => {
            return (
              <div
                key={user.id}
                onContextMenu={(e) => handleContextMenu(e, user)}
                onDoubleClick={() => onOpenPrivateChat(user)}
                className={`
                    group flex items-center space-x-2 p-1.5 md:p-2 rounded cursor-pointer transition-all
                    ${user.isOnline ? 'hover:bg-white/5 opacity-100' : 'opacity-50 hover:opacity-100 hover:bg-white/5 grayscale'} 
                    border border-transparent hover:border-white/10
                `}
              >
                <div className="relative shrink-0">
                    <img 
                        src={user.avatar || `https://ui-avatars.com/api/?name=${user.username}&background=random`} 
                        alt={user.username} 
                        className={`w-6 h-6 md:w-8 md:h-8 rounded-full border-2 ${user.banned ? 'border-red-500' : 'border-mirc-darker'} transition-all`}
                    />
                    
                    <div className={`absolute bottom-0 right-0 rounded-full border-2 border-mirc-dark bg-mirc-darker flex items-center justify-center w-3 h-3 md:w-3.5 md:h-3.5`}>
                        {user.role !== UserRole.USER ? (
                            getRoleIcon(user.role)
                        ) : (
                            <Circle size={8} className={user.isOnline ? "fill-green-500 text-green-500" : "fill-gray-500 text-gray-500"} />
                        )}
                    </div>
                </div>
                
                <div className="flex flex-col overflow-hidden">
                    <span className={`text-xs md:text-sm truncate font-medium ${getRoleColor(user)}`}>
                        {user.username}
                    </span>
                    {!user.isOnline && user.role !== UserRole.BOT && (
                        <span className="text-[9px] text-gray-500 uppercase font-bold leading-none">Away</span>
                    )}
                </div>

                {user.banned && <Lock size={12} className="text-red-500 ml-auto shrink-0" />}
              </div>
            );
        })}
      </div>

      {contextMenu && contextMenu.user && (
        <div 
            className="fixed z-50 bg-slate-800 border border-slate-600 rounded-lg shadow-2xl w-44 md:w-52 py-1 backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
            style={{ top: contextMenu.y, left: Math.min(contextMenu.x - 150, window.innerWidth - 220) }} 
        >
          <div className="px-3 py-2 border-b border-slate-700 mb-1">
            <span className="text-[10px] md:text-xs text-gray-400 font-mono block">ACTIONS FOR</span>
            <span className="font-bold text-white text-sm">{contextMenu.user.username}</span>
          </div>
          
          <button 
            className="w-full text-left px-3 py-1.5 md:px-4 md:py-2 hover:bg-mirc-pink hover:text-white flex items-center gap-2 text-xs md:text-sm"
            onClick={() => { onOpenPrivateChat(contextMenu.user!); closeMenu(); }}
          >
            <MessageCircle size={14} /> Private Message
          </button>

          {(canKick || canBan) && contextMenu.user.role !== UserRole.ADMIN && (
            <>
              <div className="h-px bg-slate-700 my-1 mx-2" />
              
              {canKick && contextMenu.user.isOnline && (
                  <button 
                    onClick={() => { onKick?.(contextMenu.user!); closeMenu(); }}
                    className="w-full text-left px-3 py-1.5 md:px-4 md:py-2 hover:bg-orange-500/20 hover:text-orange-400 flex items-center gap-2 text-xs md:text-sm text-orange-300"
                  >
                    <UserMinus size={14} /> Kick User
                  </button>
              )}

              {canBan && (
                   <button 
                    onClick={() => { onBan?.(contextMenu.user!); closeMenu(); }}
                    className="w-full text-left px-3 py-1.5 md:px-4 md:py-2 hover:bg-red-500/20 hover:text-red-400 flex items-center gap-2 text-xs md:text-sm text-red-400"
                   >
                    <Ban size={14} /> {contextMenu.user.banned ? "Unban User" : "Ban User"}
                   </button>
              )}
            </>
          )}

          {canOp && contextMenu.user.role !== UserRole.ADMIN && (
              <>
                <div className="h-px bg-slate-700 my-1 mx-2" />
                <button 
                    onClick={() => { onToggleOp?.(contextMenu.user!); closeMenu(); }}
                    className="w-full text-left px-3 py-1.5 md:px-4 md:py-2 hover:bg-blue-500/20 hover:text-blue-400 flex items-center gap-2 text-xs md:text-sm text-blue-300"
                >
                    <Shield size={14} /> {contextMenu.user.role === UserRole.OPERATOR ? "Remove OP" : "Make Operator"}
                </button>
              </>
          )}
        </div>
      )}
    </div>
  );
};

export default UserList;