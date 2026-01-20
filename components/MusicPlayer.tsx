import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipForward, Volume2, VolumeX, AlertCircle, Radio, Loader2, RotateCcw } from 'lucide-react';
import { useMIRCContext } from '../context/MIRCContext';

const MusicPlayer: React.FC = () => {
  const { pb } = useMIRCContext();
  const [currentTrack, setCurrentTrack] = useState("Yükleniyor...");
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [trackList, setTrackList] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<boolean>(false);
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
      const records = await pb.collection('room_music').getFullList({
        sort: '-created',
        requestKey: null
      });
      
      if (records && records.length > 0) {
        setTrackList(records);
        // Only set initial if empty
        if (audioUrl === "") {
            const firstTrack = records[0];
            setCurrentTrack(firstTrack.title || "Radyo");
            setCurrentIndex(0);
            setAudioUrl(getTrackSource(firstTrack));
        }
      } else {
        setCurrentTrack("Müzik Yok");
      }
    } catch (err: any) {
        console.log("Music fetch error", err);
    }
  };

  useEffect(() => {
    fetchTracks();
  }, [pb]);

  useEffect(() => {
    if (audioRef.current) {
        audioRef.current.muted = isMuted;
    }
  }, [isMuted]);

  const attemptPlay = () => {
      const audio = audioRef.current;
      if (!audio) return;
      
      setError(false);
      setIsLoading(true);

      const playPromise = audio.play();
      if (playPromise !== undefined) {
          playPromise
            .then(() => {
                setIsPlaying(true);
                setIsLoading(false);
            })
            .catch((e) => {
                console.warn("Playback blocked or failed:", e);
                setIsPlaying(false);
                setIsLoading(false);
                // Do not show error immediately for autoplay blocks, just show paused state
            });
      }
  };

  const handlePlayPause = () => {
      const audio = audioRef.current;
      if (!audio) return;

      if (error) {
          // Retry logic
          setError(false);
          audio.load();
          attemptPlay();
          return;
      }

      if (isPlaying) {
          audio.pause();
          setIsPlaying(false);
      } else {
          attemptPlay();
      }
  };
  
  const toggleMute = () => setIsMuted(!isMuted);

  const handleNext = () => {
    if (trackList && trackList.length > 0) {
      const nextIndex = (currentIndex + 1) % trackList.length;
      const nextTrack = trackList[nextIndex];
      
      setCurrentIndex(nextIndex);
      setCurrentTrack(nextTrack.title || "Yükleniyor...");
      const nextUrl = getTrackSource(nextTrack);
      
      setIsPlaying(false); // Reset UI to paused while loading
      setAudioUrl(nextUrl);
      setError(false);
      
      // On mobile, we cannot reliably autoplay next track if the user isn't interacting.
      // We set state, and if the browser allows (e.g. desktop or Android with setting), it will play via useEffect or onCanPlay.
      // For strictly blocked browsers (iOS), the user might need to tap again.
      
      // Attempt to autoplay after a short delay to let src update
      setTimeout(() => {
          if (audioRef.current) {
              attemptPlay();
          }
      }, 100);
    }
  };

  const handleError = (e: any) => {
      // Only show error if we actually tried to play and it failed
      if (audioUrl) {
          console.error("Audio tag error:", e);
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
        preload="auto"
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
                    {error ? "Hata! Tıkla" : currentTrack}
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
          onClick={handlePlayPause}
          className={`p-1.5 md:p-1.5 rounded-full text-white transition-all shadow-md active:scale-95 ${isPlaying ? 'bg-pink-500 hover:bg-pink-600' : 'bg-gray-600 hover:bg-gray-500'}`}
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