import React, { useState, useRef } from 'react';
import { Send, Image as ImageIcon, Lock, Palette, X, Bold, Italic, Underline, Smile, Mic, Square } from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (text: string, file?: File) => void;
  disabled?: boolean;
  allowAttachments?: boolean;
  isLocked?: boolean;
}

// Popular Emojis List
const EMOJIS = [
    "😀", "😂", "🥰", "😎", "🤔", "😭", "🤯", "🥳", "👻", "👽", "🤖", "💩",
    "👍", "👎", "👋", "🙏", "💪", "🫶", "🔥", "✨", "❤️", "💔", "💯", "⚠️",
    "✅", "❌", "🎉", "📅", "🚀", "💻", "📱", "📷", "🎥", "🎧", "🎮", "🍕",
    "🍔", "🍻", "🚗", "✈️", "🇹🇷", "🇺🇸"
];

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, disabled, allowAttachments = true, isLocked = false }) => {
  const [text, setText] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!text.trim()) return;

    let finalMsg = text;
    const isCommand = text.startsWith('/') && !text.startsWith('/me');

    if (selectedColor && !isCommand) {
        finalMsg = `//color ${selectedColor} ${text}`;
    }

    onSendMessage(finalMsg);
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const insertTag = (tag: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = text.substring(start, end);
      const before = text.substring(0, start);
      const after = text.substring(end);

      let newText = "";
      if (selectedText.length > 0) {
          // Wrap selection
          newText = `${before}${tag}${selectedText}${tag}${after}`;
      } else {
          // Just insert cursor inside tags
          newText = `${before}${tag}${tag}${after}`;
      }
      
      setText(newText);
      textarea.focus();
      // Move cursor inside tags? Skipping complexity for now
  };

  const handleEmojiClick = (emoji: string) => {
      setText(prev => prev + emoji);
      setShowEmojiPicker(false);
      textareaRef.current?.focus();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onSendMessage('', e.target.files[0]);
      e.target.value = '';
    }
  };

  const startRecording = async () => {
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const recorder = new MediaRecorder(stream);
          mediaRecorderRef.current = recorder;
          audioChunksRef.current = [];

          recorder.ondataavailable = (e) => {
              if (e.data.size > 0) audioChunksRef.current.push(e.data);
          };

          recorder.onstop = () => {
              const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
              const audioFile = new File([audioBlob], "voice-message.webm", { type: 'audio/webm' });
              onSendMessage('', audioFile);
              
              // Stop tracks
              stream.getTracks().forEach(track => track.stop());
          };

          recorder.start();
          setIsRecording(true);
      } catch (err) {
          alert("Microphone access denied or error occurred.");
      }
  };

  const stopRecording = () => {
      if (mediaRecorderRef.current && isRecording) {
          mediaRecorderRef.current.stop();
          setIsRecording(false);
      }
  };

  const handleColorSelect = (colorHex: string | null) => {
    setSelectedColor(colorHex);
    setShowColorPicker(false);
  };

  const presetColors = [
      { hex: '#ef4444', tw: 'bg-red-500' },    // Red
      { hex: '#facc15', tw: 'bg-yellow-400' }, // Yellow
      { hex: '#4ade80', tw: 'bg-green-400' },  // Mirc Green
      { hex: '#22d3ee', tw: 'bg-cyan-400' },   // Mirc Cyan
      { hex: '#f472b6', tw: 'bg-pink-400' },   // Mirc Pink
      { hex: '#c084fc', tw: 'bg-purple-400' }, // Mirc Purple
  ];

  return (
    <div className="flex flex-col bg-slate-900/95 backdrop-blur-sm border-t border-gray-700 relative z-20 shrink-0">
      
      {/* Formatting Toolbar */}
      {!disabled && (
          <div className="flex items-center px-2 py-1 bg-slate-950/50 border-b border-gray-800 gap-1 overflow-x-auto scrollbar-hide">
             <button onClick={() => insertTag('*')} className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-white/10" title="Bold"><Bold size={14} /></button>
             <button onClick={() => insertTag('_')} className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-white/10" title="Italic"><Italic size={14} /></button>
             <button onClick={() => insertTag('~')} className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-white/10" title="Underline"><Underline size={14} /></button>
             
             <div className="w-px h-4 bg-gray-700 mx-1" />
             
             <div className="relative">
                <button 
                    onClick={() => setShowColorPicker(!showColorPicker)} 
                    className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-white/10"
                    style={{ color: selectedColor || undefined }}
                >
                    <Palette size={14} />
                </button>
                {showColorPicker && (
                    <div className="absolute bottom-full left-0 mb-2 p-2 bg-slate-800 border border-slate-600 rounded-lg shadow-xl flex gap-2 z-50">
                        <button onClick={() => handleColorSelect(null)} className="w-5 h-5 rounded-full border border-gray-500 flex items-center justify-center"><X size={10} /></button>
                        {presetColors.map(c => (
                            <button key={c.hex} onClick={() => handleColorSelect(c.hex)} className={`w-5 h-5 rounded-full border border-gray-600 hover:scale-110 ${c.tw}`} />
                        ))}
                    </div>
                )}
             </div>

             <div className="relative">
                <button 
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)} 
                    className={`p-1.5 rounded hover:bg-white/10 ${showEmojiPicker ? 'text-yellow-400' : 'text-gray-400 hover:text-white'}`}
                >
                    <Smile size={14} />
                </button>
                {showEmojiPicker && (
                    <div className="absolute bottom-full left-0 mb-2 w-64 p-2 bg-slate-800 border border-slate-600 rounded-lg shadow-xl grid grid-cols-8 gap-1 z-50 h-48 overflow-y-auto custom-scrollbar">
                        {EMOJIS.map(emoji => (
                            <button key={emoji} onClick={() => handleEmojiClick(emoji)} className="text-xl hover:bg-white/10 rounded p-1">{emoji}</button>
                        ))}
                    </div>
                )}
             </div>

             <div className="flex-1" />

             {allowAttachments && (
                 <>
                    {isRecording ? (
                        <button onClick={stopRecording} className="flex items-center gap-2 px-2 py-0.5 bg-red-600 text-white rounded animate-pulse">
                            <Square size={12} fill="white" /> <span className="text-xs font-bold">REC</span>
                        </button>
                    ) : (
                        <button onClick={startRecording} className="p-1.5 text-red-400 hover:text-red-300 rounded hover:bg-white/10" title="Voice Message">
                            <Mic size={14} />
                        </button>
                    )}
                    
                    <button onClick={() => fileInputRef.current?.click()} className="p-1.5 text-mirc-cyan hover:text-cyan-300 rounded hover:bg-white/10" title="Image">
                        <ImageIcon size={14} />
                    </button>
                 </>
             )}
          </div>
      )}

      {/* Input Area */}
      <div className={`
        flex items-end gap-2 p-2 transition-all
        ${disabled 
            ? 'bg-slate-900 opacity-80 cursor-not-allowed' 
            : 'bg-slate-800'}
      `}>
        <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*"
            onChange={handleFileSelect}
        />
        
        {isLocked && disabled && (
             <div className="p-2 text-red-400">
                <Lock size={18} />
             </div>
        )}

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={disabled ? "Channel is muted (Admins only)" : "Type your message..."}
          style={{ color: selectedColor || undefined }}
          className={`
            flex-1 bg-transparent border-none outline-none resize-none max-h-24 md:max-h-32 min-h-[40px] py-2 font-mono text-sm
            ${disabled ? 'text-gray-500' : 'placeholder-gray-600'}
            ${!selectedColor && !disabled ? 'text-gray-200' : ''}
          `}
          rows={1}
        />

        {!disabled && (
            <button
            onClick={() => handleSubmit()}
            disabled={!text.trim()}
            className="p-2 bg-mirc-pink text-white rounded-lg hover:bg-pink-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95 mb-1"
            >
            <Send size={18} />
            </button>
        )}
      </div>
    </div>
  );
};

export default ChatInput;