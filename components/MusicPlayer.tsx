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
  
  const audioRef = useRef<HTMLAudioElement>(null);

  const getTrackSource = (track: any): string => {
      if (!track) return "";
      if (track.audio_file) {
          // Fixed: getURL -> getUrl (PocketBase SDK 0.8+)
          return pb.files.getUrl(track, track.audio_file);
      }
      if (track.url) {
          return track.url;
      }
      return "";
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
                // Pre-load first track info but DO NOT set src yet to avoid auto-download
                const firstTrack = records[0];
                setCurrentTrack(firstTrack.title || "Müzik");
                setCurrentIndex(0);
                setAudioUrl(getTrackSource(firstTrack));
            } else {
                setCurrentTrack("Liste Boş");
                setAudioUrl(""); 
            }
        } catch (err) {
            console.log("Music fetch error", err);
            setCurrentTrack("Hata");
        }
    };
    fetchTracks();
  }, [pb]);

  // Sync Mute
  useEffect(() => {
    if (audioRef.current) {
        audioRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // Unified Play Logic
  const togglePlay = () => {
      const audio = audioRef.current;
      if (!audio) return;

      if (!audioUrl) {
          // If no URL, we cannot play.
          setError(true);
          return;
      }

      if (isPlaying) {
          audio.pause();
          setIsPlaying(false);
      } else {
          setError(false);
          setIsLoading(true);
          
          const promise = audio.play();
          
          if (promise !== undefined) {
              promise
              .then(() => {
                  setIsPlaying(true);
                  setIsLoading(false);
              })
              .catch((e) => {
                  console.warn("Play blocked:", e);
                  setIsPlaying(false);
                  setIsLoading(false);
                  
                  // Handle "NotSupportedError" which happens if src is empty or invalid format
                  if (e.name === 'NotSupportedError' || e.message.includes('source')) {
                      setError(true);
                      // Try moving to next track automatically if current is broken? 
                      // Maybe not, just show error state.
                  }
              });
          }
      }
  };

  const handleNext = () => {
    if (trackList && trackList.length > 0) {
      const nextIndex = (currentIndex + 1) % trackList.length;
      const nextTrack = trackList[nextIndex];
      
      setCurrentIndex(nextIndex);
      setCurrentTrack(nextTrack.title || "Yükleniyor...");
      
      const nextUrl = getTrackSource(nextTrack);
      setAudioUrl(nextUrl);
      
      setIsPlaying(false); 
      setError(false);
      
      // Small delay to allow state update and DOM to register new src
      setTimeout(() => {
          if (audioRef.current && nextUrl) {
              const p = audioRef.current.play();
              if (p) {
                  p.then(() => setIsPlaying(true))
                   .catch((e) => {
                       console.warn("Autoplay next failed:", e);
                       setIsPlaying(false);
                       if (e.name === 'NotSupportedError') setError(true);
                   });
              }
          }
      }, 200);
    }
  };

  const handleError = () => {
      if (audioUrl) {
          console.error("Audio Load Error for URL:", audioUrl);
          setError(true);
          setIsPlaying(false);
          setIsLoading(false);
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
        onPlay={() => { setIsPlaying(true); setError(false); setIsLoading(false); }}
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
            <AlertCircle size={16} className="text-red-400 shrink-0" />
        ) : (
            <Radio size={16} className={`shrink-0 ${isPlaying ? "animate-pulse text-mirc-pink" : ""}`} />
        )}
        
        <div className="flex flex-col overflow-hidden w-20 md:w-32">
          <span className="text-[8px] md:text-[9px] font-bold text-gray-500 uppercase tracking-widest leading-none hidden md:block">mIRC RADIO</span>
          <div className="relative overflow-hidden h-4 md:h-5 w-full">
             <div className={`whitespace-nowrap ${isPlaying && !error && !isLoading ? 'animate-marquee' : 'truncate'}`}>
                <span className={`text-xs md:text-sm font-mono ${error ? 'text-red-300 font-bold' : 'text-pink-400'}`}>
                    {error ? "Hata! Geç" : currentTrack}
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
          disabled={!audioUrl}
          className={`p-1.5 md:p-1.5 rounded-full text-white transition-all shadow-md active:scale-95 ${!audioUrl ? 'opacity-50 cursor-not-allowed bg-gray-700' : (isPlaying ? 'bg-pink-500 hover:bg-pink-600' : 'bg-gray-600 hover:bg-gray-500')}`}
        >
          {error ? <RotateCcw size={14} /> : (isPlaying ? <Pause size={14} fill="white" /> : <Play size={14} fill="white" />)}
        </button>

        <button onClick={handleNext} className="text-gray-400 hover:text-cyan-400 transition-colors p-1">
          <SkipForward size={16} />
        </button>
      </div>
    </div>
  );
};

export default MusicPlayer;