import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipForward, Volume2, VolumeX, AlertCircle, Radio } from 'lucide-react';
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
        // Explicitly handle the "Only admins" error
        setCurrentTrack("Erişim Reddedildi");
        setError("Admin Paneli > API Rules Açın");
      } else if (err.status !== 0) { // Ignore abort errors
        console.warn("Müzik listesi hatası:", err.message);
        setCurrentTrack("Bağlantı Hatası");
      }
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
  }, [pb]); // Added pb dependency

  // Validation Check for URL issues
  useEffect(() => {
      if (!audioUrl) return;

      // 1. Check for Mixed Content (HTTP on HTTPS)
      if (window.location.protocol === 'https:' && audioUrl.startsWith('http:')) {
          setError("HTTPS Gerekli (HTTP Link)");
          setIsPlaying(false);
          return;
      }

      // 2. Check for Playlist files (Browsers can't play these directly)
      if (audioUrl.includes('.pls') || audioUrl.includes('.m3u') || audioUrl.includes('.asx')) {
          setError("Hatalı Link (.pls/.m3u)");
          setIsPlaying(false);
          return;
      }
      
      setError(null);
  }, [audioUrl]);

  // Handle Playback State
  useEffect(() => {
    if (!audioRef.current) return;

    if (isPlaying && audioUrl && !error) {
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          console.log("Playback prevented:", err);
          setIsPlaying(false);
        });
      }
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, audioUrl, error]);

  useEffect(() => {
    if (audioRef.current) {
        audioRef.current.muted = isMuted;
    }
  }, [isMuted]);

  const togglePlay = () => {
      if (error) {
          handleNext(); // Skip broken track
      } else {
          setIsPlaying(!isPlaying);
      }
  };
  
  const toggleMute = () => setIsMuted(!isMuted);

  const handleNext = () => {
    if (trackList && trackList.length > 0) {
      const nextIndex = (currentIndex + 1) % trackList.length;
      const nextTrack = trackList[nextIndex];
      
      setCurrentIndex(nextIndex);
      setCurrentTrack(nextTrack.title || "İsimsiz Şarkı");
      setAudioUrl(getTrackSource(nextTrack));
      setIsPlaying(true);
      setError(null);
    }
  };

  const handleStreamError = (e: any) => {
      if (!error) {
          // Only warn if we actually have a URL that failed
          if (audioUrl) {
            console.warn("Stream error for URL:", audioUrl);
            setError("Yayın Çevrimdışı");
          }
          setIsPlaying(false);
      }
  };

  return (
    <div className={`
        flex items-center gap-1 md:gap-3 p-1 px-2 md:p-2 md:px-4 rounded-full border backdrop-blur-md shadow-lg select-none min-w-fit md:min-w-[150px] transition-colors
        ${error ? 'bg-red-900/40 border-red-500/50' : 'bg-black/60 border-cyan-500/30'}
    `}>
      <audio 
        key={audioUrl}
        ref={audioRef} 
        src={audioUrl || undefined} 
        onEnded={handleNext} 
        onError={handleStreamError}
        preload="none"
      />
      
      <div className="hidden md:flex items-center space-x-3 text-cyan-400">
        {error ? <AlertCircle size={18} className="text-red-400" /> : <Radio size={18} className={isPlaying ? "animate-pulse text-mirc-pink" : ""} />}
        <div className="flex flex-col overflow-hidden w-32">
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-none">mIRC RADIO</span>
          <span className={`text-sm font-mono truncate ${error ? 'text-red-300 font-bold' : 'text-pink-400'}`}>
            {error || currentTrack}
          </span>
        </div>
      </div>

      <div className="hidden md:block h-6 w-px bg-gray-600 mx-2"></div>

      <div className="flex items-center gap-1 md:gap-2">
        <button onClick={toggleMute} className="hidden md:block text-gray-400 hover:text-white transition-colors">
          {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>

        <button 
          onClick={togglePlay}
          className={`p-1.5 rounded-full text-white transition-all shadow-md ${isPlaying ? 'bg-pink-500 hover:bg-pink-600' : 'bg-gray-600 hover:bg-gray-500'}`}
        >
          {isPlaying ? <Pause size={14} fill="white" /> : <Play size={14} fill="white" />}
        </button>

        <button onClick={handleNext} className="text-gray-400 hover:text-cyan-400 transition-colors">
          <SkipForward size={16} />
        </button>
      </div>

      {isPlaying && !error && (
        <div className="flex items-end space-x-[2px] h-3 ml-1">
            <div className="w-[2px] bg-cyan-400 animate-[bounce_1s_infinite]"></div>
            <div className="w-[2px] bg-pink-500 animate-[bounce_1.2s_infinite]"></div>
            <div className="w-[2px] bg-cyan-400 animate-[bounce_0.8s_infinite]"></div>
        </div>
      )}
    </div>
  );
};

export default MusicPlayer;