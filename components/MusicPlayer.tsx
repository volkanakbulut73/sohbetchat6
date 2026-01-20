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
  const [isBuffering, setIsBuffering] = useState(false); 
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);

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
  }, [pb]);

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

  // ROBUST MOBILE PLAY LOGIC
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
          setIsBuffering(true);
          setError(null);
          
          try {
              // Force load for mobile if stream is stale
              if (audio.networkState === HTMLMediaElement.NETWORK_NO_SOURCE || audio.networkState === HTMLMediaElement.NETWORK_EMPTY) {
                  audio.load();
              }
              
              const playPromise = audio.play();
              if (playPromise !== undefined) {
                  playPromise.then(() => {
                      setIsPlaying(true);
                      setIsBuffering(false);
                  }).catch(err => {
                      console.error("Play error:", err);
                      setIsPlaying(false);
                      setIsBuffering(false);
                      // Mobile often blocks auto-play, requiring clearer feedback
                      if (err.name === 'NotAllowedError') {
                           setError("Dokun ve Başlat");
                      } else {
                           setError("Oynatılamadı");
                      }
                  });
              }
          } catch (e) {
              setIsPlaying(false);
              setIsBuffering(false);
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
      
      if (audioRef.current) {
          audioRef.current.pause();
          setIsPlaying(false);
      }
      
      setAudioUrl(nextUrl);
      setError(null);
      setIsBuffering(true); 
      // Auto-play next track if we were already playing or user clicked next
      // Use timeout to allow React to update the src prop first
      setTimeout(() => {
          if(audioRef.current) {
              audioRef.current.load(); // Important for mobile to recognize new source
              audioRef.current.play().catch(() => setIsPlaying(false));
          }
      }, 100);
    }
  };

  const handleStreamError = (e: any) => {
      if (!error && audioUrl && isPlaying) {
        // Only show error if we were trying to play
        console.log("Stream error details:", e);
        setError("Yayın Hatası");
        setIsPlaying(false);
        setIsBuffering(false);
      }
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
        onPlaying={() => { setIsBuffering(false); setIsPlaying(true); }}
        onWaiting={() => setIsBuffering(true)}
        preload="none" 
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