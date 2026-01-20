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
      // requestKey: null prevents auto-cancellation
      const records = await pb.collection('room_music').getFullList({
        sort: '-created',
        requestKey: null
      });
      
      if (records && records.length > 0) {
        setTrackList(records);
        // Only set initial track if nothing is playing or URL is empty
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
      if (err.status === 403) {
        setCurrentTrack("Erişim Reddedildi");
        setError("API Rules");
      } else if (err.status !== 0) {
        console.warn("Müzik listesi hatası:", err.message);
        setCurrentTrack("Bağlantı Hatası");
      }
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTracks();

    const subscribe = async () => {
      try {
        await pb.collection('room_music').subscribe('*', (e) => {
          if (e.action === 'create' || e.action === 'update' || e.action === 'delete') {
              fetchTracks();
          }
        });
      } catch (err) {
        // Silent catch for 403 or cancellation errors
      }
    };

    subscribe();
    return () => {
      try {
          pb.collection('room_music').unsubscribe('*').catch(() => {});
      } catch(_) {}
    };
  }, [pb]);

  // Validation Check for URL issues
  useEffect(() => {
      if (!audioUrl) return;
      
      // 1. Check for Mixed Content (HTTP on HTTPS)
      if (window.location.protocol === 'https:' && audioUrl.startsWith('http:')) {
          setError("HTTPS Gerekli");
          setIsPlaying(false);
          return;
      }
      // 2. Check for Playlist files
      if (audioUrl.includes('.pls') || audioUrl.includes('.m3u') || audioUrl.includes('.asx')) {
          setError("Hatalı Link");
          setIsPlaying(false);
          return;
      }
      setError(null);
  }, [audioUrl]);

  // Mute effect
  useEffect(() => {
    if (audioRef.current) {
        audioRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // IMPORTANT: On mobile, we must call .play() directly from the click handler.
  // We removed the useEffect that listened to [isPlaying] to trigger playback.
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
      } else {
          try {
              // Attempt to play directly
              await audio.play();
              setIsPlaying(true);
          } catch (err) {
              console.error("Playback failed:", err);
              setIsPlaying(false);
              // Provide visual feedback if it failed (e.g. mobile policy)
              // But usually this catch block runs if user hasn't interacted, 
              // since this IS a click handler, it should pass on most devices.
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
      setAudioUrl(nextUrl);
      
      setError(null);
      setIsLoading(true);

      // Auto-play next track
      // Note: Some mobile browsers block this if not directly triggered by user
      // We set a small timeout to let the new src load
      setTimeout(async () => {
          if (audioRef.current) {
              try {
                  await audioRef.current.play();
                  setIsPlaying(true);
              } catch (e) {
                  console.warn("Autoplay blocked for next track", e);
                  setIsPlaying(false);
              } finally {
                  setIsLoading(false);
              }
          }
      }, 100);
    }
  };

  const handleStreamError = (e: any) => {
      if (!error && audioUrl) {
        console.warn("Stream error for URL:", audioUrl);
        setError("Yayın Hatası");
        setIsPlaying(false);
      }
      setIsLoading(false);
  };

  const handleCanPlay = () => {
      setIsLoading(false);
  };

  return (
    <div className={`
        flex items-center gap-2 p-1 px-3 md:p-2 md:px-4 rounded-full border backdrop-blur-md shadow-lg select-none transition-colors max-w-[200px] md:max-w-none
        ${error ? 'bg-red-900/60 border-red-500/50' : 'bg-black/60 border-cyan-500/30'}
    `}>
      <audio 
        key={audioUrl}
        ref={audioRef} 
        src={audioUrl || undefined} 
        onEnded={handleNext} 
        onError={handleStreamError}
        onCanPlay={handleCanPlay}
        preload="metadata"
        playsInline
      />
      
      {/* Track Info - Now Visible on Mobile (Truncated) */}
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
          onClick={togglePlay}
          className={`p-1.5 md:p-1.5 rounded-full text-white transition-all shadow-md active:scale-95 ${isPlaying ? 'bg-pink-500 hover:bg-pink-600' : 'bg-gray-600 hover:bg-gray-500'}`}
        >
          {isPlaying ? <Pause size={14} fill="white" /> : <Play size={14} fill="white" />}
        </button>

        <button onClick={handleNext} className="text-gray-400 hover:text-cyan-400 transition-colors p-1">
          <SkipForward size={16} />
        </button>
      </div>

      {isPlaying && !error && (
        <div className="hidden md:flex items-end space-x-[2px] h-3 ml-1">
            <div className="w-[2px] bg-cyan-400 animate-[bounce_1s_infinite]"></div>
            <div className="w-[2px] bg-pink-500 animate-[bounce_1.2s_infinite]"></div>
            <div className="w-[2px] bg-cyan-400 animate-[bounce_0.8s_infinite]"></div>
        </div>
      )}
    </div>
  );
};

export default MusicPlayer;