import React, { useState, useRef, useEffect } from 'react';
import { Send, Image as ImageIcon, Lock, Palette, X, Bold, Italic, Underline, Smile, Mic, Square } from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (text: string, file?: File) => void;
  disabled?: boolean;
  allowAttachments?: boolean;
  isLocked?: boolean;
}

const EMOJIS = [
    "😀", "😂", "🥰", "😎", "🤔", "😭", "🤯", "🥳", "👻", "👽", "🤖", "💩",
    "👍", "👎", "👋", "🙏", "💪", "🫶", "🔥", "✨", "❤️", "💔", "💯", "⚠️",
    "✅", "❌", "🎉", "📅", "🚀", "💻", "📱", "📷", "🎥", "🎧", "🎮", "🍕",
    "🍔", "🍻", "🚗", "✈️", "🇹🇷", "🇺🇸"
];

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, disabled, allowAttachments = true, isLocked = false }) => {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const htmlToMarkdown = (html: string) => {
    let text = html;
    // Basic conversion for DB storage
    text = text.replace(/<b>(.*?)<\/b>/g, '**$1**');
    text = text.replace(/<strong>(.*?)<\/strong>/g, '**$1**');
    text = text.replace(/<i>(.*?)<\/i>/g, '*$1*');
    text = text.replace(/<em>(.*?)<\/em>/g, '*$1*');
    text = text.replace(/<u>(.*?)<\/u>/g, '__$1__');
    text = text.replace(/<div>/g, '\n').replace(/<\/div>/g, '');
    text = text.replace(/<br>/g, '\n');
    // Remove other tags
    const temp = document.createElement('div');
    temp.innerHTML = text;
    return temp.textContent || temp.innerText || "";
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!editorRef.current) return;
    
    const htmlContent = editorRef.current.innerHTML;
    const plainText = editorRef.current.innerText.trim();
    
    if (!plainText && !htmlContent.includes('<img')) return;

    let finalMsg = htmlToMarkdown(htmlContent);
    
    if (selectedColor) {
        finalMsg = `//color ${selectedColor} ${finalMsg}`;
    }

    onSendMessage(finalMsg);
    editorRef.current.innerHTML = '';
    setSelectedColor(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const execCommand = (command: string, value: string | undefined = undefined) => {
      document.execCommand(command, false, value);
      editorRef.current?.focus();
  };

  const handleEmojiClick = (emoji: string) => {
      if (editorRef.current) {
          editorRef.current.focus();
          document.execCommand('insertText', false, emoji);
      }
      setShowEmojiPicker(false);
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
          recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
          recorder.onstop = () => {
              const audioFile = new File([new Blob(audioChunksRef.current, { type: 'audio/webm' })], "voice.webm", { type: 'audio/webm' });
              onSendMessage('', audioFile);
              stream.getTracks().forEach(track => track.stop());
          };
          recorder.start();
          setIsRecording(true);
      } catch (err) { alert("Mikrofon erişimi reddedildi."); }
  };

  const stopRecording = () => {
      if (mediaRecorderRef.current && isRecording) {
          mediaRecorderRef.current.stop();
          setIsRecording(false);
      }
  };

  const presetColors = [
      { hex: '#ef4444', tw: 'bg-red-500' },
      { hex: '#facc15', tw: 'bg-yellow-400' },
      { hex: '#4ade80', tw: 'bg-green-400' },
      { hex: '#22d3ee', tw: 'bg-cyan-400' },
      { hex: '#f472b6', tw: 'bg-pink-400' },
      { hex: '#c084fc', tw: 'bg-purple-400' },
  ];

  return (
    <div className="flex flex-col bg-slate-900/95 backdrop-blur-sm border-t border-gray-700 relative z-20 shrink-0">
      {!disabled && (
          <div className="flex items-center px-2 py-1 bg-slate-950/50 border-b border-gray-800 gap-1 flex-wrap">
             <button type="button" onClick={() => execCommand('bold')} className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-white/10" title="Kalın">
                <Bold size={16} />
             </button>
             <button type="button" onClick={() => execCommand('italic')} className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-white/10" title="İtalik">
                <Italic size={16} />
             </button>
             <button type="button" onClick={() => execCommand('underline')} className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-white/10" title="Altı Çizili">
                <Underline size={16} />
             </button>
             
             <div className="w-px h-4 bg-gray-700 mx-1" />
             
             <div className="relative">
                <button type="button" onClick={() => setShowColorPicker(!showColorPicker)} className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-white/10" style={{ color: selectedColor || undefined }}>
                    <Palette size={16} />
                </button>
                {showColorPicker && (
                    <div className="absolute bottom-full left-0 mb-2 p-2 bg-slate-800 border border-slate-600 rounded-lg shadow-xl flex gap-2 z-50 animate-in fade-in slide-in-from-bottom-2">
                        <button type="button" onClick={() => {setSelectedColor(null); setShowColorPicker(false);}} className="w-5 h-5 rounded-full border border-gray-500 flex items-center justify-center bg-transparent"><X size={10} /></button>
                        {presetColors.map(c => (
                            <button type="button" key={c.hex} onClick={() => {setSelectedColor(c.hex); setShowColorPicker(false);}} className={`w-5 h-5 rounded-full border border-gray-600 hover:scale-110 transition-transform ${c.tw}`} />
                        ))}
                    </div>
                )}
             </div>

             <div className="relative">
                <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className={`p-1.5 rounded hover:bg-white/10 ${showEmojiPicker ? 'text-yellow-400' : 'text-gray-400 hover:text-white'}`}>
                    <Smile size={16} />
                </button>
                {showEmojiPicker && (
                    <div className="absolute bottom-full left-0 mb-2 w-64 p-2 bg-slate-800 border border-slate-600 rounded-lg shadow-xl grid grid-cols-8 gap-1 z-50 h-48 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-bottom-2">
                        {EMOJIS.map(emoji => (
                            <button type="button" key={emoji} onClick={() => handleEmojiClick(emoji)} className="text-xl hover:bg-white/10 rounded p-1">{emoji}</button>
                        ))}
                    </div>
                )}
             </div>

             <div className="flex-1" />

             {allowAttachments && (
                 <>
                    {isRecording ? (
                        <button type="button" onClick={stopRecording} className="flex items-center gap-2 px-2 py-0.5 bg-red-600 text-white rounded animate-pulse">
                            <Square size={12} fill="white" /> <span className="text-xs font-bold uppercase">Dur</span>
                        </button>
                    ) : (
                        <button type="button" onClick={startRecording} className="p-1.5 text-red-400 hover:text-red-300 rounded hover:bg-white/10" title="Sesli Mesaj"><Mic size={16} /></button>
                    )}
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="p-1.5 text-mirc-cyan hover:text-cyan-300 rounded hover:bg-white/10" title="Resim Gönder"><ImageIcon size={16} /></button>
                 </>
             )}
          </div>
      )}

      <div className={`flex items-end gap-2 p-2 transition-all ${disabled ? 'bg-slate-900 opacity-80 cursor-not-allowed' : 'bg-slate-800'}`}>
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} />
        {isLocked && disabled && <div className="p-2 text-red-400"><Lock size={18} /></div>}
        
        <div 
          ref={editorRef}
          contentEditable={!disabled}
          onKeyDown={handleKeyDown}
          style={{ color: selectedColor || undefined }}
          className={`flex-1 bg-transparent border-none outline-none overflow-y-auto max-h-32 min-h-[40px] py-2 px-1 font-mono text-sm whitespace-pre-wrap ${disabled ? 'text-gray-500' : 'text-gray-200'}`}
          data-placeholder="Mesajınızı yazın..."
        />

        {!disabled && (
            <button type="button" onClick={() => handleSubmit()} className="p-2 bg-mirc-pink text-white rounded-lg hover:bg-pink-500 transition-all transform active:scale-95 mb-1 shrink-0">
                <Send size={18} />
            </button>
        )}
      </div>

      <style>{`
        [contenteditable]:empty:before {
            content: attr(data-placeholder);
            color: #4b5563;
            cursor: text;
        }
        [contenteditable] b, [contenteditable] strong { font-weight: bold; }
        [contenteditable] i, [contenteditable] em { font-style: italic; }
        [contenteditable] u { text-decoration: underline; }
      `}</style>
    </div>
  );
};

export default ChatInput;