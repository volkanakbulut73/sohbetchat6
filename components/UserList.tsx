import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { Shield, Star, Bot, Smile, MessageCircle, Ban, UserMinus, Lock } from 'lucide-react';

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
      default: return <Smile size={12} className="text-mirc-green" />;
    }
  };

  const getRoleColor = (user: User) => {
    if (user.banned) return "text-red-500 line-through decoration-2";
    switch (user.role) {
      case UserRole.ADMIN: return "text-yellow-400 font-bold shadow-yellow-400/20";
      case UserRole.OPERATOR: return "text-blue-400 font-semibold";
      case UserRole.BOT: return "text-mirc-pink font-mono";
      default: return "text-gray-300";
    }
  }

  // FILTER: Only show Online users and Bots. Hide Offline users.
  const visibleUsers = users.filter(u => u.isOnline || u.role === UserRole.BOT);

  // SORT: Admin -> Operator -> Bot -> User
  const sortedUsers = [...visibleUsers].sort((a, b) => {
      const roles = { [UserRole.ADMIN]: 0, [UserRole.OPERATOR]: 1, [UserRole.BOT]: 2, [UserRole.USER]: 3 };
      return roles[a.role] - roles[b.role];
  });

  const canKick = currentUserRole === UserRole.ADMIN || currentUserRole === UserRole.OPERATOR;
  const canBan = currentUserRole === UserRole.ADMIN;
  const canOp = currentUserRole === UserRole.ADMIN;

  return (
    <div className="w-48 md:w-64 bg-mirc-dark border-l border-gray-700 flex flex-col h-full overflow-hidden" onClick={closeMenu}>
      <div className="p-2 md:p-3 border-b border-gray-700 bg-mirc-darker/50 mt-8 md:mt-0">
        <h3 className="font-bold text-gray-400 text-[10px] md:text-xs uppercase tracking-widest flex items-center gap-2">
           Online Users ({visibleUsers.length})
        </h3>
      </div>
      
      <div className="flex-1 overflow-y-auto p-1 md:p-2 space-y-0.5">
        {sortedUsers.map((user) => (
          <div
            key={user.id}
            onContextMenu={(e) => handleContextMenu(e, user)}
            onDoubleClick={() => onOpenPrivateChat(user)}
            className={`
                group flex items-center space-x-2 p-1.5 md:p-2 rounded cursor-pointer transition-all
                hover:bg-white/5 border border-transparent hover:border-white/10
                opacity-100
            `}
          >
            <div className="relative">
                <img 
                    src={user.avatar || `https://ui-avatars.com/api/?name=${user.username}&background=random`} 
                    alt={user.username} 
                    className={`w-6 h-6 md:w-8 md:h-8 rounded-full border-2 ${user.banned ? 'border-red-500' : 'border-mirc-darker'}`}
                />
                {user.role !== UserRole.USER && (
                    <div className={`absolute -bottom-1 -right-1 bg-mirc-darker rounded-full p-0.5`}>
                        {getRoleIcon(user.role)}
                    </div>
                )}
            </div>
            
            <span className={`text-xs md:text-sm truncate ${getRoleColor(user)}`}>
              {user.username}
            </span>
            {user.banned && <Lock size={12} className="text-red-500 ml-auto" />}
          </div>
        ))}
      </div>

      {/* Admin Context Menu */}
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
              
              {canKick && (
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