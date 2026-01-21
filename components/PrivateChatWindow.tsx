import React, { useState, useEffect, useRef } from 'react';
import { User, PrivateMessage } from '../types';
import { X, Minus, Send, Image as ImageIcon } from 'lucide-react';

interface PrivateChatWindowProps {
  recipient: User;
  currentUser: User;
  messages: PrivateMessage[];
  onClose: () => void;
  onSendMessage: (text: string, file?: File) => void;
}

const PrivateChatWindow: React.FC<PrivateChatWindowProps> = ({ 
    recipient, currentUser, messages, onClose, onSendMessage 
}) => {
    const [text, setText] = useState('');
    const [minimized, setMinimized] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, minimized]);

    const handleSend = () => {
        if(!text.trim()) return;
        onSendMessage(text);
        setText('');
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            onSendMessage('', e.target.files[0]);
            e.target.value = '';
        }
    };

    if (minimized) {
        return (
            <div 
                className="w-48 bg-mirc-dark border border-mirc-pink/50 rounded-t-lg cursor-pointer flex items-center justify-between px-3 py-2 shadow-lg hover:bg-slate-800"
                onClick={() => setMinimized(false)}
            >
                <span className="text-sm font-bold text-mirc-pink truncate">{recipient.username}</span>
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
            </div>
        );
    }

    return (
        <div className="w-80 h-96 bg-mirc-darker border border-gray-700 rounded-t-lg shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-2 border-b border-gray-700 flex justify-between items-center select-none">
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <img src={recipient.avatar || `https://ui-avatars.com/api/?name=${recipient.username}&background=random`} className="w-6 h-6 rounded-full" alt="" />
                        <span className={`absolute bottom-0 right-0 block w-2 h-2 rounded-full ring-1 ring-slate-900 ${recipient.isOnline ? 'bg-green-500' : 'bg-gray-500'}`} />
                    </div>
                    <span className="font-bold text-sm text-gray-200">{recipient.username}</span>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={() => setMinimized(true)} className="p-1 hover:text-white text-gray-400"><Minus size={14} /></button>
                    <button onClick={onClose} className="p-1 hover:text-red-400 text-gray-400"><X size={14} /></button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-[#111]" ref={scrollRef}>
                {messages.map(msg => {
                    const isMe = msg.sender === currentUser.id;
                    return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] rounded px-2 py-1 text-sm ${isMe ? 'bg-mirc-pink/20 text-pink-100' : 'bg-slate-800 text-gray-300'}`}>
                                {msg.attachment ? (
                                    <div className="flex flex-col">
                                        {msg.type === 'image' && msg.attachment ? (
                                            <img src={msg.attachment} alt="attachment" className="max-w-full rounded mb-1 max-h-32" />
                                        ) : (
                                            <span className="italic text-blue-300">File Attachment</span>
                                        )}
                                        <span className="text-xs opacity-70">{msg.text}</span>
                                    </div>
                                ) : (
                                    msg.text
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Input */}
            <div className="p-2 bg-slate-800 border-t border-gray-700">
                <div className="flex gap-1">
                    <button 
                        className="text-gray-400 hover:text-white p-1"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <ImageIcon size={16} />
                    </button>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*"
                        onChange={handleFileSelect}
                    />
                </div>
                <div className="flex gap-2 mt-1">
                    <input 
                        className="flex-1 bg-black/30 border border-gray-600 rounded px-2 py-1 text-sm outline-none focus:border-mirc-pink text-white"
                        value={text}
                        onChange={e => setText(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSend()}
                        placeholder="Message..."
                    />
                    <button onClick={handleSend} className="bg-mirc-pink hover:bg-pink-600 text-white p-1 rounded">
                        <Send size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PrivateChatWindow;