import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipForward, Volume2, VolumeX, AlertCircle, Radio, Loader2, RotateCcw } from 'lucide-react';
import { useMIRCContext } from '../context/MIRCContext';

const MusicPlayer: React.FC = () => {
  const { pb } = useMIRCContext();
  const [currentTrack, setCurrentTrack] = useState("Radyo Hazır");
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [trackList, setTrackList] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(false);
  const [skipMessage, setSkipMessage] = useState<string>("");
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const consecutiveErrors = useRef(0);
  const skipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getTrackSource = (track: any): string => {
      if (!track) return "";
      if (track.audio_file) {
          return pb.files.getUrl(track, track.audio_file);
      }
      if (track.url) {
          return track.url;
      }
      return "";
  };

  // Helper to trigger the next track when an error occurs
  const triggerAutoSkip = (errorType: string) => {
      console.warn(`Radio Error [${errorType}]: Skipping track ${currentTrack}`);
      
      if (trackList.length <= 1) {
          setError(true);
          setSkipMessage("Yayın Bulunamadı");
          return;
      }

      setError(true);
      setIsPlaying(false);
      setIsLoading(false);
      clearWatchdog();

      if (consecutiveErrors.current < 5) {
          consecutiveErrors.current += 1;
          const waitTime = 1200; // Faster skip for better UX
          setSkipMessage(`Bağlantı Hatası... Geçiliyor...`);
          
          if (skipTimeoutRef.current) clearTimeout(skipTimeoutRef.current);
          skipTimeoutRef.current = setTimeout(() => {
              handleNext();
          }, waitTime);
      } else {
          setSkipMessage("Çok fazla hata.");
          consecutiveErrors.current = 0; 
      }
  };

  const clearWatchdog = () => {
      if (loadWatchdogRef.current) {
          clearTimeout(loadWatchdogRef.current);
          loadWatchdogRef.current = null;
      }
  };

  const startWatchdog = () => {
      clearWatchdog();
      // If loading takes more than 6 seconds, it's likely a blocked IP or SSL error
      loadWatchdogRef.current = setTimeout(() => {
          if (isLoading && !isPlaying) {
              triggerAutoSkip("LoadingTimeout (SSL/Blocked)");
          }
      }, 6000);
  };

  // Initial Fetch
  useEffect(() => {
    const fetchTracks = async () => {
        try {
            const records = await pb.collection('room_music').getFullList({
                sort: '-created',
                requestKey: null
            });
            if (records && records.length > 0) {
                setTrackList(records);
                const firstTrack = records[0];
                setCurrentTrack(firstTrack.title || "Müzik");
                setCurrentIndex(0);
                setAudioUrl(getTrackSource(firstTrack));
            } else {
                setCurrentTrack("Liste Boş");
                setAudioUrl(""); 
            }
        } catch (err) {
            console.error("Music fetch error", err);
            setCurrentTrack("Hata");
        }
    };
    fetchTracks();
    
    return () => {
        if (skipTimeoutRef.current) clearTimeout(skipTimeoutRef.current);
        clearWatchdog();
    };
  }, [pb]);

  // Sync Mute
  useEffect(() => {
    if (audioRef.current) {
        audioRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // Safe Play Function used internally
  const safePlay = async () => {
      const audio = audioRef.current;
      if (!audio || !audioUrl) return;

      try {
          setIsLoading(true);
          setError(false);
          setSkipMessage("");
          startWatchdog();
          
          const playPromise = audio.play();
          
          if (playPromise !== undefined) {
              await playPromise;
              setIsPlaying(true);
              setIsLoading(false);
              clearWatchdog();
              consecutiveErrors.current = 0;
          }
      } catch (err: any) {
          setIsLoading(false);
          if (err.name === 'AbortError') {
              setIsPlaying(false);
              clearWatchdog();
          } else if (err.name === 'NotSupportedError' || err.message.toLowerCase().includes('source') || err.message.toLowerCase().includes('supported')) {
              triggerAutoSkip("NotSupported/SSL");
          } else {
              if (err.name !== 'NotAllowedError') {
                 triggerAutoSkip("GeneralPlaybackError");
              }
              setIsPlaying(false);
          }
      }
  };

  // Unified Play Logic
  const togglePlay = () => {
      const audio = audioRef.current;
      if (!audio) return;

      if (!audioUrl) {
          setError(true);
          return;
      }

      if (audio.paused) {
          safePlay();
      } else {
          audio.pause();
          setIsPlaying(false);
          setIsLoading(false);
          clearWatchdog();
          if (skipTimeoutRef.current) {
              clearTimeout(skipTimeoutRef.current);
              setSkipMessage("");
          }
      }
  };

  const handleNext = () => {
    if (trackList && trackList.length > 0) {
      if (skipTimeoutRef.current) clearTimeout(skipTimeoutRef.current);
      clearWatchdog();
      setSkipMessage("");

      const nextIndex = (currentIndex + 1) % trackList.length;
      const nextTrack = trackList[nextIndex];
      
      setCurrentIndex(nextIndex);
      setCurrentTrack(nextTrack.title || "Yükleniyor...");
      
      const nextUrl = getTrackSource(nextTrack);
      setAudioUrl(nextUrl);
      
      setIsPlaying(false); 
      setError(false);
      setIsLoading(false);
      
      // Delay slightly to allow the <audio> tag src to update
      setTimeout(() => {
          if (audioRef.current && nextUrl) {
             safePlay();
          }
      }, 300);
    }
  };

  const handleError = (e: any) => {
      // Native audio error events (like 404s or network disconnects)
      if (audioUrl) {
          triggerAutoSkip("NativeAudioError");
      }
  };

  return (
    <div className={`
        flex items-center gap-2 p-1 px-3 md:p-2 md:px-4 rounded-full border backdrop-blur-md shadow-lg select-none transition-colors max-w-[180px] md:max-w-none
        ${error ? 'bg-red-900/60 border-red-500/50' : 'bg-black/60 border-cyan-500/30'}
    `}>
      <audio 
        ref={audioRef} 
        src={audioUrl} 
        onEnded={handleNext} 
        onPause={() => setIsPlaying(false)}
        onPlay={() => { setIsPlaying(true); setError(false); setIsLoading(false); clearWatchdog(); consecutiveErrors.current = 0; }}
        onWaiting={() => setIsLoading(true)}
        onCanPlay={() => setIsLoading(false)}
        onError={handleError}
        playsInline
        preload="none" 
      />
      
      {/* Track Info */}
      <div className="flex items-center space-x-2 md:space-x-3 text-cyan-400 overflow-hidden flex-1 md:flex-initial">
        {isLoading ? (
             <Loader2 size={16} className="animate-spin text-mirc-pink shrink-0" />
        ) : error ? (
            <AlertCircle size={16} className="text-red-400 shrink-0 animate-pulse" />
        ) : (
            <Radio size={16} className={`shrink-0 ${isPlaying ? "animate-pulse text-mirc-pink" : "text-gray-500"}`} />
        )}
        
        <div className="flex flex-col overflow-hidden w-20 md:w-32">
          <span className="text-[8px] md:text-[9px] font-bold text-gray-500 uppercase tracking-widest leading-none hidden md:block">mIRC RADIO</span>
          <div className="relative overflow-hidden h-4 md:h-5 w-full">
             <div className={`whitespace-nowrap ${isPlaying && !error && !isLoading ? 'animate-marquee' : 'truncate'}`}>
                <span className={`text-xs md:text-sm font-mono ${error ? 'text-red-300 font-bold' : (isLoading ? 'text-yellow-400' : 'text-pink-400')}`}>
                    {skipMessage ? skipMessage : (error ? "Bağlantı Hatası" : currentTrack)}
                </span>
             </div>
          </div>
        </div>
      </div>

      <div className="h-4 w-px bg-gray-600 mx-1 hidden md:block"></div>

      <div className="flex items-center gap-2 shrink-0">
        <button onClick={() => setIsMuted(!isMuted)} className="hidden md:block text-gray-400 hover:text-white transition-colors">
          {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>

        <button 
          onClick={togglePlay}
          disabled={!audioUrl || isLoading}
          className={`p-1.5 md:p-1.5 rounded-full text-white transition-all shadow-md active:scale-95 ${(!audioUrl || isLoading) ? 'opacity-50 cursor-wait bg-gray-700' : (isPlaying ? 'bg-pink-500 hover:bg-pink-600' : 'bg-gray-600 hover:bg-gray-500')}`}
        >
          {isLoading ? <Loader2 size={14} className="animate-spin" /> : (error ? <RotateCcw size={14} /> : (isPlaying ? <Pause size={14} fill="white" /> : <Play size={14} fill="white" />))}
        </button>

        <button 
            onClick={handleNext} 
            className={`transition-colors p-1 ${error ? 'text-white animate-bounce' : 'text-gray-400 hover:text-cyan-400'}`}
            title="Sıradaki Kanal"
        >
          <SkipForward size={16} />
        </button>
      </div>
    </div>
  );
};

export default MusicPlayer;