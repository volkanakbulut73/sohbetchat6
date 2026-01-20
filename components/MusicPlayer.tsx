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
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
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
        if (!isPlaying && audioUrl === "") {
            const firstTrack = records[0];
            setCurrentTrack(firstTrack.title || "Radyo");
            setCurrentIndex(0);
            setAudioUrl(getTrackSource(firstTrack));
        }
      } else {
        setCurrentTrack("Liste Boş");
        setError(null);
      }
    } catch (err: any) {
        console.log("Music fetch error");
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

  // Handle Play Button
  const handlePlayClick = () => {
      const audio = audioRef.current;
      if (!audio) return;

      if (isPlaying) {
          audio.pause();
          setIsPlaying(false);
      } else {
          setError(null);
          // Just call play. Do not call load() here to avoid interrupting mobile buffers.
          const promise = audio.play();
          
          if (promise !== undefined) {
              promise
                .then(() => {
                    setIsPlaying(true);
                    setError(null);
                })
                .catch((e) => {
                    console.error("Play error:", e);
                    setIsPlaying(false);
                    // Mobile requires user gesture. If this fails, it might be format or network.
                    setError("Hata"); 
                });
          }
      }
  };
  
  const toggleMute = () => setIsMuted(!isMuted);

  const handleNext = () => {
    if (trackList && trackList.length > 0) {
      const nextIndex = (currentIndex + 1) % trackList.length;
      const nextTrack = trackList[nextIndex];
      
      setCurrentIndex(nextIndex);
      setCurrentTrack(nextTrack.title || "Sıradaki...");
      const nextUrl = getTrackSource(nextTrack);
      
      // Update state
      setAudioUrl(nextUrl);
      setError(null);
      setIsPlaying(true); // Optimistically set playing
      
      // Use small timeout to allow React to update the DOM src attribute
      setTimeout(() => {
          if (audioRef.current) {
              const promise = audioRef.current.play();
              if (promise) {
                  promise.catch(() => {
                      setIsPlaying(false);
                      setError("Oynatılamadı");
                  });
              }
          }
      }, 100);
    }
  };

  // If error occurs (e.g. 404 or codec), try next song automatically
  const handleError = () => {
      console.log("Audio Error occurred, skipping...");
      setError("Hata");
      setIsPlaying(false);
      // Optional: Auto skip to next if one fails
      // setTimeout(handleNext, 1000); 
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
        onPlay={() => { setIsPlaying(true); setError(null); }}
        onError={handleError}
        playsInline
        preload="metadata"
      />
      
      {/* Track Info */}
      <div className="flex items-center space-x-2 md:space-x-3 text-cyan-400 overflow-hidden flex-1 md:flex-initial">
        {error ? (
            <AlertCircle size={16} className="text-red-400 shrink-0" />
        ) : (
            <Radio size={16} className={`shrink-0 ${isPlaying ? "animate-pulse text-mirc-pink" : ""}`} />
        )}
        
        <div className="flex flex-col overflow-hidden w-20 md:w-32">
          <span className="text-[8px] md:text-[9px] font-bold text-gray-500 uppercase tracking-widest leading-none hidden md:block">mIRC RADIO</span>
          <div className="relative overflow-hidden h-4 md:h-5 w-full">
             <div className={`whitespace-nowrap ${isPlaying && !error ? 'animate-marquee' : 'truncate'}`}>
                <span className={`text-xs md:text-sm font-mono ${error ? 'text-red-300 font-bold' : 'text-pink-400'}`}>
                    {error || currentTrack}
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
          onClick={handlePlayClick}
          className={`p-1.5 md:p-1.5 rounded-full text-white transition-all shadow-md active:scale-95 ${isPlaying ? 'bg-pink-500 hover:bg-pink-600' : 'bg-gray-600 hover:bg-gray-500'}`}
        >
          {isPlaying ? <Pause size={14} fill="white" /> : <Play size={14} fill="white" />}
        </button>

        <button onClick={handleNext} className="text-gray-400 hover:text-cyan-400 transition-colors p-1">
          <SkipForward size={16} />
        </button>
      </div>
    </div>
  );
};

export default MusicPlayer;