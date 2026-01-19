import React, { useEffect, useRef } from 'react';
import { Message, User } from '../types';

interface MessageListProps {
  messages: Message[];
  currentUser: User | null;
  usersMap: Map<string, User>;
}

const MessageList: React.FC<MessageListProps> = ({ messages, currentUser, usersMap }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const formatContent = (text: string) => {
    let style = {};
    let content = text;
    let isAction = false;

    if (text.startsWith('/me ')) {
        isAction = true;
        content = text.substring(4);
        style = { ...style, fontStyle: 'italic', color: '#f472b6' };
    }

    if (content.includes('//bold ')) {
        content = content.replace('//bold ', '');
        style = { ...style, fontWeight: 'bold' };
    }

    const colorMatch = content.match(/\/\/color\s+(#[0-9a-fA-F]{3,6})\s+/);
    if (colorMatch) {
        style = { ...style, color: colorMatch[1] };
        content = content.replace(colorMatch[0], '');
    }

    return <span style={style} className={isAction ? "text-mirc-pink" : ""}>{content}</span>;
  };

  return (
    <div className="flex-1 overflow-y-auto p-2 md:p-4 space-y-2 md:space-y-3 bg-mirc-darker custom-scrollbar" ref={scrollRef}>
      {messages.map((msg) => {
        const user = msg.expand?.user || usersMap.get(msg.user);
        const isBot = user?.role === 'bot';
        const isMe = currentUser?.id === msg.user;
        const isAction = msg.text.startsWith('/me');

        return (
          <div key={msg.id} className={`flex items-start gap-2 md:gap-3 group ${isMe ? 'flex-row-reverse' : ''}`}>
            {/* Message Body */}
            <div className={`flex flex-col max-w-[85%] md:max-w-[80%] ${isMe ? 'items-end' : 'items-start'}`}>
               {!isAction && (
                    <span className={`text-[10px] md:text-xs font-bold mb-0.5 ${isBot ? 'text-mirc-pink' : 'text-mirc-cyan'}`}>
                        {user?.username || 'Unknown'} 
                        {isBot && <span className="ml-1 text-[9px] bg-mirc-pink text-white px-1 rounded">BOT</span>}
                    </span>
               )}
              
              <div 
                className={`
                    py-1.5 px-2 md:py-2 md:px-3 rounded-lg text-xs md:text-sm font-mono break-words shadow-sm relative
                    ${isAction 
                        ? 'bg-transparent text-gray-300 italic w-full text-center border-none' 
                        : isMe 
                            ? 'bg-slate-700 text-white rounded-tr-none' 
                            : 'bg-slate-800 text-gray-200 rounded-tl-none border border-slate-700'}
                `}
              >
                {isAction && <span className="mr-2 text-mirc-pink">* {user?.username}</span>}
                {msg.attachment ? (
                     msg.type === 'image' ? (
                        <img src={msg.attachment} alt="attachment" className="max-w-full rounded-md max-h-40 md:max-h-60" />
                     ) : (
                        <a href={msg.attachment} target="_blank" rel="noreferrer" className="text-blue-400 underline">Attachment</a>
                     )
                ) : (
                    formatContent(msg.text)
                )}
              </div>
              <span className="text-[9px] md:text-[10px] text-gray-600 mt-0.5">{new Date(msg.created).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default MessageList;