import React, { useState, useRef } from 'react';
import { Send, Image as ImageIcon, Mic, Lock, Palette, X } from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (text: string, file?: File) => void;
  disabled?: boolean;
  allowAttachments?: boolean;
  isLocked?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, disabled, allowAttachments = true, isLocked = false }) => {
  const [text, setText] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!text.trim()) return;

    let finalMsg = text;
    
    // Only apply color if it's not a system command (starts with / but not /me)
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onSendMessage('', e.target.files[0]);
      e.target.value = '';
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
    <div className="p-2 pb-4 md:p-4 bg-slate-900/95 backdrop-blur-sm border-t border-gray-700 relative z-20 shrink-0">
      <div className={`
        flex items-end gap-1 md:gap-2 p-1.5 md:p-2 rounded-xl border transition-all
        ${disabled 
            ? 'bg-slate-900 border-red-900/50 opacity-80 cursor-not-allowed' 
            : 'bg-slate-800 border-slate-700 focus-within:border-mirc-pink focus-within:shadow-[0_0_15px_rgba(244,114,182,0.15)]'}
      `}>
        {allowAttachments && !disabled && (
          <>
            <button 
                className="p-1.5 md:p-2 text-gray-400 hover:text-mirc-cyan transition-colors"
                onClick={() => fileInputRef.current?.click()}
            >
              <ImageIcon size={18} className="md:w-5 md:h-5" />
            </button>
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*,audio/*"
                onChange={handleFileSelect}
            />
          </>
        )}
        
        {/* Custom Color Picker Popup */}
        {!disabled && (
            <div className="relative">
                <button 
                    className={`p-1.5 md:p-2 transition-colors ${showColorPicker ? 'text-white' : 'text-gray-400 hover:text-white'}`}
                    style={{ color: selectedColor || undefined }}
                    onClick={() => setShowColorPicker(!showColorPicker)}
                    title="Choose Text Color"
                >
                    <Palette size={18} className="md:w-5 md:h-5" />
                </button>
                
                {showColorPicker && (
                    <div className="absolute bottom-full left-0 mb-3 p-2 bg-slate-800 border border-slate-600 rounded-lg shadow-xl flex gap-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                        <button
                            onClick={() => handleColorSelect(null)}
                            className="w-6 h-6 rounded-full border border-gray-500 bg-transparent flex items-center justify-center hover:bg-white/10"
                            title="Default Color"
                        >
                            <X size={12} className="text-gray-400" />
                        </button>
                        {presetColors.map((c) => (
                            <button
                                key={c.hex}
                                onClick={() => handleColorSelect(c.hex)}
                                className={`w-6 h-6 rounded-full border border-gray-600 hover:scale-110 hover:border-white transition-all ${c.tw}`}
                                title={c.hex}
                            />
                        ))}
                    </div>
                )}
            </div>
        )}

        {isLocked && disabled && (
             <div className="p-2 text-red-400">
                <Lock size={18} />
             </div>
        )}

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={disabled ? "Channel is muted (Admins only)" : "Type..."}
          style={{ color: selectedColor || undefined }}
          className={`
            flex-1 bg-transparent border-none outline-none resize-none max-h-24 md:max-h-32 min-h-[36px] md:min-h-[44px] py-2 font-mono text-xs md:text-sm
            ${disabled ? 'text-gray-500' : 'placeholder-gray-500'}
            ${!selectedColor && !disabled ? 'text-gray-200' : ''}
          `}
          rows={1}
        />
        
        {allowAttachments && !disabled && (
          <button 
              className="p-1.5 md:p-2 text-gray-400 hover:text-mirc-pink transition-colors"
              title="Voice Message (Mock)"
          >
            <Mic size={18} className="md:w-5 md:h-5" />
          </button>
        )}

        {!disabled && (
            <button
            onClick={() => handleSubmit()}
            disabled={!text.trim()}
            className="p-1.5 md:p-2 bg-mirc-pink text-white rounded-lg hover:bg-pink-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95"
            >
            <Send size={16} className="md:w-[18px] md:h-[18px]" />
            </button>
        )}
      </div>
    </div>
  );
};

export default ChatInput;