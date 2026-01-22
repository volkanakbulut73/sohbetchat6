import React, { useEffect, useRef } from 'react';
import { Message, User } from '../types';
import { Play } from 'lucide-react';

interface MessageListProps {
  messages: Message[]; // Or PrivateMessage, strictly they share enough fields
  currentUser: User | null;
  usersMap: Map<string, User>;
  isPrivate?: boolean; // Context flag
}

const MessageList: React.FC<MessageListProps> = ({ messages, currentUser, usersMap, isPrivate = false }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Enhanced parser for *bold*, _italic_, ~underline~ and colors
  const formatContent = (text: string) => {
    if (!text) return null;
    
    // Split by tokens but keep delimiters to reconstruct
    // This is a simple parser. For production, consider a proper AST parser.
    // Order: Color -> Bold -> Italic -> Underline
    
    let contentElements: React.ReactNode[] = [text];

    // Helper to replace text with React Nodes based on regex
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
            parts.forEach((part, i) => {
                if (regex.test(part)) { // This check depends on how split works with capturing groups
                   // Since split includes capturing groups, we need to verify logic.
                   // Simpler approach: matchAll or manual scan.
                   // Let's stick to a simpler recursive replacement or just basic HTML-like rendering for this demo
                }
            });
            
            // Simpler approach for this specific demo:
            // Use split with capturing group.
            // e.g. "foo *bar* baz".split(/(\*.*?\*)/g) -> ["foo ", "*bar*", " baz"]
            const splitParts = node.split(regex);
            splitParts.forEach((part, idx) => {
                 if (regex.test(part)) {
                     newNodes.push(wrapper(part, idx));
                 } else if (part !== "") {
                     newNodes.push(part);
                 }
            });
        });
        return newNodes;
    };

    // 1. Color (//color #hex text) - Handle whole line overrides first
    const colorMatch = text.match(/^\/\/color\s+(#[0-9a-fA-F]{3,6})\s+(.*)/);
    let baseColor: string | undefined = undefined;
    let processText = text;

    if (colorMatch) {
        baseColor = colorMatch[1];
        processText = colorMatch[2];
        contentElements = [processText];
    }

    // 2. Bold (*text*)
    contentElements = replaceWithTag(contentElements, /(\*[^\*]+\*)/g, (match, i) => (
        <span key={`b-${i}`} className="font-bold">{match.slice(1, -1)}</span>
    ));

    // 3. Italic (_text_)
    contentElements = replaceWithTag(contentElements, /(_[^_]+_)/g, (match, i) => (
        <span key={`i-${i}`} className="italic">{match.slice(1, -1)}</span>
    ));

    // 4. Underline (~text~)
    contentElements = replaceWithTag(contentElements, /(~[^~]+~)/g, (match, i) => (
        <span key={`u-${i}`} className="underline">{match.slice(1, -1)}</span>
    ));

    return <span style={{ color: baseColor }}>{contentElements}</span>;
  };

  return (
    <div className="flex-1 overflow-y-auto p-2 md:p-4 space-y-2 md:space-y-3 bg-mirc-darker custom-scrollbar" ref={scrollRef}>
      {messages.map((msg) => {
        // Handle User Resolving (works for public and private msg structure)
        let user: User | undefined;
        let isMe = false;
        
        if (isPrivate) {
            // Logic for PrivateMessage
            // @ts-ignore - Dynamic check
            isMe = msg.sender === currentUser?.id;
            // @ts-ignore
            const userId = isMe ? msg.sender : msg.sender; // In PM list, we want to see the sender's avatar
            user = usersMap.get(userId);
            // Fallback for current user if not in map
            if (isMe && !user) user = currentUser!;
        } else {
            // Logic for Room Message
             // @ts-ignore
            user = msg.expand?.user || usersMap.get(msg.user);
             // @ts-ignore
            isMe = currentUser?.id === msg.user;
        }

        const isBot = user?.role === 'bot';
        const isAction = msg.text?.startsWith('/me');

        return (
          <div key={msg.id} className={`flex items-start gap-2 md:gap-3 group ${isMe ? 'flex-row-reverse' : ''}`}>
            {/* Avatar */}
            {!isMe && (
                <div className="shrink-0">
                    <img 
                        src={user?.avatar || `https://ui-avatars.com/api/?name=${user?.username || '?'}&background=random`} 
                        className="w-8 h-8 rounded-full border border-gray-600" 
                        alt="avatar" 
                    />
                </div>
            )}

            {/* Message Body */}
            <div className={`flex flex-col max-w-[85%] md:max-w-[80%] ${isMe ? 'items-end' : 'items-start'}`}>
               {!isAction && (
                    <span className={`text-[10px] md:text-xs font-bold mb-0.5 ${isBot ? 'text-mirc-pink' : (isMe ? 'text-green-400' : 'text-mirc-cyan')}`}>
                        {user?.username || 'Unknown'} 
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
                
                {msg.type === 'audio' && msg.attachment ? (
                     <div className="flex items-center gap-2 min-w-[200px]">
                         <audio controls src={msg.attachment} className="h-8 w-full max-w-[250px]" />
                     </div>
                ) : msg.attachment ? (
                     msg.type === 'image' ? (
                        <img src={msg.attachment} alt="attachment" className="max-w-full rounded-md max-h-40 md:max-h-60" />
                     ) : (
                        <a href={msg.attachment} target="_blank" rel="noreferrer" className="text-blue-400 underline flex items-center gap-1">
                            📎 Attachment
                        </a>
                     )
                ) : (
                    formatContent(msg.text)
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default MessageList;