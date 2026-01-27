import React, { useEffect, useRef, useState } from 'react';
import { Message, User } from '../types';
import { Play, X, ZoomIn } from 'lucide-react';
import { useMIRCContext } from '../context/MIRCContext';

interface MessageListProps {
  messages: Message[];
  currentUser: User | null;
  usersMap: Map<string, User>;
  isPrivate?: boolean;
}

const MessageList: React.FC<MessageListProps> = ({ messages, currentUser, usersMap, isPrivate = false }) => {
  const { pb } = useMIRCContext();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const formatContent = (text: string) => {
    if (!text) return null;
    
    // Check for color tag
    const colorMatch = text.match(/^\/\/color\s+(#[0-9a-fA-F]{3,6})\s+(.*)/);
    let baseColor: string | undefined = undefined;
    let processText = text;

    if (colorMatch) {
        baseColor = colorMatch[1];
        processText = colorMatch[2];
    }

    let contentElements: React.ReactNode[] = [processText];

    const replaceWithTag = (
        nodes: React.ReactNode[], 
        regex: RegExp, 
        wrapper: (match: string, i: number) => React.ReactNode
    ) => {
        const newNodes: React.ReactNode[] = [];
        nodes.forEach((node) => {
            if (typeof node !== 'string') {
                newNodes.push(node);
                return;
            }
            const parts = node.split(regex);
            parts.forEach((part, idx) => {
                 if (regex.test(part)) {
                     newNodes.push(wrapper(part, idx));
                 } else if (part !== "") {
                     newNodes.push(part);
                 }
            });
        });
        return newNodes;
    };

    // Robust Formatting:
    // Bold: **text**
    contentElements = replaceWithTag(contentElements, /(\*\*[^\*]+\*\*)/g, (match, i) => (
        <span key={`b-${i}`} className="font-bold">{match.slice(2, -2)}</span>
    ));
    // Italic: *text* (must not be double star)
    contentElements = replaceWithTag(contentElements, /(\*[^\*]+\*)/g, (match, i) => (
        <span key={`i-${i}`} className="italic">{match.slice(1, -1)}</span>
    ));
    // Underline: __text__
    contentElements = replaceWithTag(contentElements, /(__[^_]+__)/g, (match, i) => (
        <span key={`u-${i}`} className="underline">{match.slice(2, -2)}</span>
    ));

    return <span style={{ color: baseColor }}>{contentElements}</span>;
  };

  return (
    <>
        <div className="flex-1 overflow-y-auto p-2 md:p-4 space-y-2 md:space-y-3 bg-mirc-darker custom-scrollbar" ref={scrollRef}>
        {messages.map((msg) => {
            let user: User | undefined;
            let isMe = false;
            
            if (isPrivate) {
                // @ts-ignore
                isMe = msg.sender === currentUser?.id;
                // @ts-ignore
                const userId = isMe ? msg.sender : msg.sender;
                user = usersMap.get(userId) || (isMe ? (currentUser as User) : undefined);
            } else {
                // @ts-ignore
                user = msg.expand?.user || usersMap.get(msg.user);
                // @ts-ignore
                isMe = currentUser?.id === msg.user;
            }

            const isBot = user?.role === 'bot';
            const isAction = msg.text?.startsWith('/me');
            const fileUrl = msg.attachment ? pb.files.getUrl(msg, msg.attachment) : null;

            return (
            <div key={msg.id} className={`flex items-start gap-2 md:gap-3 group ${isMe ? 'flex-row-reverse' : ''}`}>
                {!isMe && (
                    <div className="shrink-0">
                        <img 
                            src={user?.avatar ? pb.files.getUrl(user, user.avatar) : `https://ui-avatars.com/api/?name=${user?.username || '?'}&background=random`} 
                            className="w-8 h-8 rounded-full border border-gray-600 object-cover" 
                            alt="avatar" 
                        />
                    </div>
                )}

                <div className={`flex flex-col max-w-[85%] md:max-w-[80%] ${isMe ? 'items-end' : 'items-start'}`}>
                {!isAction && (
                        <span className={`text-[10px] md:text-xs font-bold mb-0.5 ${isBot ? 'text-mirc-pink' : (isMe ? 'text-green-400' : 'text-mirc-cyan')}`}>
                            {user?.username || 'Bilinmiyor'} 
                            {isBot && <span className="ml-1 text-[9px] bg-mirc-pink text-white px-1 rounded">BOT</span>}
                            <span className="text-[9px] text-gray-600 font-normal ml-2">{new Date(msg.created).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
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
                    
                    {fileUrl ? (
                        <div className="mt-1">
                             {msg.type === 'audio' ? (
                                <audio controls src={fileUrl} className="h-8 w-full max-w-[200px]" />
                             ) : msg.type === 'image' ? (
                                <div className="relative group/img cursor-pointer" onClick={() => setViewingImage(fileUrl)}>
                                    <img src={fileUrl} alt="attachment" className="max-w-full rounded-md max-h-48 md:max-h-60 object-contain bg-black/20" loading="lazy" />
                                    <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover/img:opacity-100">
                                        <ZoomIn className="text-white drop-shadow-md" />
                                    </div>
                                </div>
                             ) : (
                                <a href={fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-blue-400 hover:text-blue-300 underline p-2 bg-black/20 rounded">📎 Dosyayı İndir</a>
                             )}
                             {msg.text && msg.text !== 'Image' && msg.text !== 'Voice Message' && (
                                 <div className="mt-2 pt-2 border-t border-white/10">{formatContent(msg.text)}</div>
                             )}
                        </div>
                    ) : (
                        formatContent(msg.text)
                    )}
                </div>
                </div>
            </div>
            );
        })}
        </div>

        {viewingImage && (
            <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setViewingImage(null)}>
                <button className="absolute top-4 right-4 text-white hover:text-red-500 p-2 bg-black/50 rounded-full" onClick={() => setViewingImage(null)}><X size={32} /></button>
                <img src={viewingImage} className="max-w-full max-h-full object-contain rounded shadow-2xl" onClick={(e) => e.stopPropagation()} />
            </div>
        )}
    </>
  );
};

export default MessageList;