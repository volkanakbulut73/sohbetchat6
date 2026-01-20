import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipForward, Volume2, VolumeX, AlertCircle, Radio, Loader2 } from 'lucide-react';
import { useMIRCContext } from '../context/MIRCContext';

const MusicPlayer: React.FC = () => {
  const { pb } = useMIRCContext();
  const [currentTrack, setCurrentTrack] = useState("Yükleniyor...");
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [trackList, setTrackList] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false); // New state for mobile loading
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);

  // Helper to determine the source URL (File vs External URL)
  const getTrackSource = (track: any): string => {
      if (!track) return "";
      if (track.audio_file) {
          return pb.files.getURL(track, track.audio_file);
      }
      if (track.url) {
          return track.url;
      }
      return "";
  };

  const fetchTracks = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const records = await pb.collection('room_music').getFullList({
        sort: '-created',
        requestKey: null
      });
      
      if (records && records.length > 0) {
        setTrackList(records);
        // Only set initial track if nothing is playing
        if (!isPlaying && audioUrl === "") {
            const firstTrack = records[0];
            setCurrentTrack(firstTrack.title || "İsimsiz Şarkı");
            setCurrentIndex(0);
            setAudioUrl(getTrackSource(firstTrack));
        }
      } else {
        setCurrentTrack("Müzik Listesi Boş");
      }
    } catch (err: any) {
        // Silent error
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTracks();
    // Subscribe logic is simplified to avoid complexity in this snippet
    // as fetching on mount is sufficient for the fix demonstration
  }, [pb]);

  // Validation Check
  useEffect(() => {
      if (!audioUrl) return;
      if (window.location.protocol === 'https:' && audioUrl.startsWith('http:')) {
          setError("HTTPS Gerekli");
          setIsPlaying(false);
          return;
      }
      setError(null);
  }, [audioUrl]);

  useEffect(() => {
    if (audioRef.current) {
        audioRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // CRITICAL MOBILE FIX:
  // The play action must be direct. If it's loading, we show buffering.
  const togglePlay = async () => {
      const audio = audioRef.current;
      if (!audio) return;

      if (error) {
          handleNext();
          return;
      }

      if (isPlaying) {
          audio.pause();
          setIsPlaying(false);
          setIsBuffering(false);
      } else {
          // Set buffering first, wait for promise
          setIsBuffering(true);
          try {
              await audio.play();
              setIsPlaying(true);
              setIsBuffering(false);
          } catch (err: any) {
              console.error("Playback failed:", err);
              setIsPlaying(false);
              setIsBuffering(false);
              // Common mobile error: "The request is not allowed by the user agent..."
              if (err.name === 'NotAllowedError') {
                   setError("Play'e Basın");
              }
          }
      }
  };
  
  const toggleMute = () => setIsMuted(!isMuted);

  const handleNext = () => {
    if (trackList && trackList.length > 0) {
      const nextIndex = (currentIndex + 1) % trackList.length;
      const nextTrack = trackList[nextIndex];
      
      setCurrentIndex(nextIndex);
      setCurrentTrack(nextTrack.title || "İsimsiz Şarkı");
      const nextUrl = getTrackSource(nextTrack);
      
      // Stop current before switching src
      if (audioRef.current) {
          audioRef.current.pause();
          setIsPlaying(false);
      }
      
      setAudioUrl(nextUrl);
      setError(null);
      setIsBuffering(true); // Assume buffering for next track
    }
  };

  const handleStreamError = (e: any) => {
      if (!error && audioUrl) {
        setError("Yayın Hatası");
        setIsPlaying(false);
        setIsBuffering(false);
      }
  };

  // When audio is actually ready to play or playing
  const handlePlaying = () => {
      setIsBuffering(false);
      setIsPlaying(true);
  };
  
  const handleWaiting = () => {
      if (isPlaying) setIsBuffering(true);
  };

  return (
    <div className={`
        flex items-center gap-2 p-1 px-3 md:p-2 md:px-4 rounded-full border backdrop-blur-md shadow-lg select-none transition-colors max-w-[180px] md:max-w-none
        ${error ? 'bg-red-900/60 border-red-500/50' : 'bg-black/60 border-cyan-500/30'}
    `}>
      <audio 
        key={audioUrl}
        ref={audioRef} 
        src={audioUrl || undefined} 
        onEnded={handleNext} 
        onError={handleStreamError}
        onPlaying={handlePlaying}
        onWaiting={handleWaiting}
        preload="auto"
        playsInline
      />
      
      {/* Track Info */}
      <div className="flex items-center space-x-2 md:space-x-3 text-cyan-400 overflow-hidden flex-1 md:flex-initial">
        {isLoading || isBuffering ? (
             <Loader2 size={16} className="animate-spin text-mirc-pink shrink-0" />
        ) : error ? (
            <AlertCircle size={16} className="text-red-400 shrink-0" />
        ) : (
            <Radio size={16} className={`shrink-0 ${isPlaying ? "animate-pulse text-mirc-pink" : ""}`} />
        )}
        
        <div className="flex flex-col overflow-hidden w-20 md:w-32">
          <span className="text-[8px] md:text-[9px] font-bold text-gray-500 uppercase tracking-widest leading-none hidden md:block">mIRC RADIO</span>
          <div className="relative overflow-hidden h-4 md:h-5 w-full">
             <div className={`whitespace-nowrap ${isPlaying && !error && !isBuffering ? 'animate-marquee' : 'truncate'}`}>
                <span className={`text-xs md:text-sm font-mono ${error ? 'text-red-300 font-bold' : 'text-pink-400'}`}>
                    {error || (isBuffering ? "Yükleniyor..." : currentTrack)}
                </span>
             </div>
          </div>
        </div>
      </div>

      <div className="h-4 w-px bg-gray-600 mx-1 hidden md:block"></div>

      <div className="flex items-center gap-2 shrink-0">
        <button onClick={toggleMute} className="hidden md:block text-gray-400 hover:text-white transition-colors">
          {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>

        <button 
          onClick={togglePlay}
          className={`p-1.5 md:p-1.5 rounded-full text-white transition-all shadow-md active:scale-95 ${isPlaying || isBuffering ? 'bg-pink-500 hover:bg-pink-600' : 'bg-gray-600 hover:bg-gray-500'}`}
        >
          {isBuffering ? <Loader2 size={14} className="animate-spin" /> : (isPlaying ? <Pause size={14} fill="white" /> : <Play size={14} fill="white" />)}
        </button>

        <button onClick={handleNext} className="text-gray-400 hover:text-cyan-400 transition-colors p-1">
          <SkipForward size={16} />
        </button>
      </div>
    </div>
  );
};

export default MusicPlayer;