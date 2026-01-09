"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Upload,
  Link,
  Music,
  X,
  Rewind,
  FastForward,
  SkipBack,
  SkipForward,
  Disc,
  Youtube,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";

interface MusicTogetherProps {
  onClose?: () => void;
}

declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
    YT: any;
  }
}

export function MusicTogether({ onClose }: MusicTogetherProps) {
  const [source, setSource] = useState<string>("");
  const [isYoutube, setIsYoutube] = useState(false);
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showSetup, setShowSetup] = useState(true);
  const [urlInput, setUrlInput] = useState("");
  const [metadata, setMetadata] = useState({ title: "No Track Selected", artist: "Select a song to begin" });

  const audioRef = useRef<HTMLAudioElement>(null);
  const ytPlayerRef = useRef<any>(null);
  const ytContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);

  // Load YouTube API
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }
  }, []);

  const updateMediaSession = useCallback(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: metadata.title,
        artist: metadata.artist,
        album: "Chatify Music",
        artwork: [
          { src: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=512&h=512&fit=crop", sizes: "512x512", type: "image/png" }
        ]
      });

      navigator.mediaSession.setActionHandler('play', () => togglePlay());
      navigator.mediaSession.setActionHandler('pause', () => togglePlay());
      navigator.mediaSession.setActionHandler('seekbackward', () => skip(-10));
      navigator.mediaSession.setActionHandler('seekforward', () => skip(10));
      navigator.mediaSession.setActionHandler('previoustrack', () => skip(-30));
      navigator.mediaSession.setActionHandler('nexttrack', () => skip(30));
    }
  }, [metadata, isPlaying]);

  useEffect(() => {
    updateMediaSession();
  }, [updateMediaSession]);

  const onPlayerStateChange = (event: any) => {
    // 1 = playing, 2 = paused
    if (event.data === 1) {
      setIsPlaying(true);
      setDuration(ytPlayerRef.current.getDuration());
      startProgressTimer();
    } else {
      setIsPlaying(false);
      stopProgressTimer();
    }
  };

  const startProgressTimer = () => {
    stopProgressTimer();
    progressInterval.current = setInterval(() => {
      if (isYoutube && ytPlayerRef.current) {
        setCurrentTime(ytPlayerRef.current.getCurrentTime());
      } else if (audioRef.current) {
        setCurrentTime(audioRef.current.currentTime);
      }
    }, 1000);
  };

  const stopProgressTimer = () => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
    }
  };

  const initYoutubePlayer = (videoId: string) => {
    if (ytPlayerRef.current) {
      ytPlayerRef.current.loadVideoById(videoId);
      return;
    }

    const createPlayer = () => {
      ytPlayerRef.current = new window.YT.Player('youtube-player', {
        height: '0',
        width: '0',
        videoId: videoId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          rel: 0,
          showinfo: 0,
          modestbranding: 1
        },
        events: {
          onStateChange: onPlayerStateChange,
          onReady: (event: any) => {
            event.target.playVideo();
            setDuration(event.target.getDuration());
          }
        }
      });
    };

    if (window.YT && window.YT.Player) {
      createPlayer();
    } else {
      window.onYouTubeIframeAPIReady = createPlayer;
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLocalFile(file);
      setIsYoutube(false);
      const url = URL.createObjectURL(file);
      setSource(url);
      setMetadata({ title: file.name.replace(/\.[^/.]+$/, ""), artist: "Local Audio" });
      setShowSetup(false);
      setTimeout(() => {
        audioRef.current?.play();
        setIsPlaying(true);
        startProgressTimer();
      }, 100);
    }
  };

  const handleUrlSubmit = () => {
    const url = urlInput.trim();
    if (!url) return;

    // Check for YouTube
    const ytMatch = url.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) {
      const videoId = ytMatch[1];
      setIsYoutube(true);
      setSource(videoId);
      setMetadata({ title: "YouTube Audio", artist: "Remote Stream" });
      setShowSetup(false);
      initYoutubePlayer(videoId);
    } else {
      // Direct audio link
      setIsYoutube(false);
      setSource(url);
      setMetadata({ title: "Remote Audio", artist: url.split('/').pop() || "Unknown" });
      setShowSetup(false);
      setTimeout(() => {
        audioRef.current?.play();
        setIsPlaying(true);
        startProgressTimer();
      }, 100);
    }
  };

  const togglePlay = () => {
    if (isYoutube && ytPlayerRef.current) {
      if (isPlaying) {
        ytPlayerRef.current.pauseVideo();
      } else {
        ytPlayerRef.current.playVideo();
      }
    } else if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (value: number[]) => {
    if (isYoutube && ytPlayerRef.current) {
      ytPlayerRef.current.seekTo(value[0], true);
    } else if (audioRef.current) {
      audioRef.current.currentTime = value[0];
    }
    setCurrentTime(value[0]);
  };

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0]);
    if (isYoutube && ytPlayerRef.current) {
      ytPlayerRef.current.setVolume(value[0] * 100);
    } else if (audioRef.current) {
      audioRef.current.volume = value[0];
    }
    setIsMuted(value[0] === 0);
  };

  const skip = (seconds: number) => {
    const newTime = currentTime + seconds;
    handleSeek([Math.max(0, Math.min(newTime, duration))]);
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const resetPlayer = () => {
    if (localFile && !isYoutube) {
      URL.revokeObjectURL(source);
    }
    if (ytPlayerRef.current) {
      ytPlayerRef.current.destroy();
      ytPlayerRef.current = null;
    }
    stopProgressTimer();
    setSource("");
    setLocalFile(null);
    setShowSetup(true);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setUrlInput("");
    setMetadata({ title: "No Track Selected", artist: "Select a song to begin" });
  };

  return (
    <div className="h-full flex flex-col bg-[#010101] text-white overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 via-transparent to-purple-500/5 pointer-events-none" />
      
      <AnimatePresence mode="wait">
        {showSetup ? (
          <motion.div
            key="setup"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="flex-1 flex flex-col items-center justify-center p-6 relative z-10"
          >
            <div className="w-full max-w-md space-y-10">
              <div className="text-center space-y-4">
                <div className="w-24 h-24 mx-auto bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[2rem] flex items-center justify-center shadow-2xl relative group">
                  <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-20 group-hover:opacity-40 transition-opacity" />
                  <Music className="w-12 h-12 text-white relative z-10" />
                </div>
                <div>
                  <h2 className="text-4xl font-black uppercase italic tracking-tighter">Music Together</h2>
                  <p className="text-sm text-white/30 font-medium tracking-widest uppercase mt-2">Harmonize your experience</p>
                </div>
              </div>

              <div className="space-y-6">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="audio/*"
                  className="hidden"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-20 bg-white/[0.03] border border-white/10 hover:bg-white/[0.07] hover:border-indigo-500/30 rounded-3xl transition-all group"
                >
                  <div className="flex items-center gap-6 px-4">
                    <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Upload className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div className="text-left">
                      <p className="font-black uppercase italic text-sm">Upload Local Track</p>
                      <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">MP3, WAV, M4A</p>
                    </div>
                  </div>
                </Button>

                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full h-px bg-white/5" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-[#010101] px-4 text-[10px] font-black uppercase tracking-[0.3em] text-white/20">or stream via link</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                      <Search className="w-4 h-4 text-white/20 group-focus-within:text-indigo-400 transition-colors" />
                    </div>
                    <Input
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="YouTube URL or Audio link..."
                      className="h-16 bg-white/[0.03] border-white/10 rounded-2xl pl-14 pr-6 text-white placeholder:text-white/20 focus:border-indigo-500/50 transition-all"
                      onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
                    />
                  </div>
                  <Button
                    onClick={handleUrlSubmit}
                    disabled={!urlInput.trim()}
                    className="w-full h-14 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-2xl font-black uppercase tracking-widest text-xs disabled:opacity-30 transition-all shadow-lg shadow-indigo-500/20"
                  >
                    Initialize Stream
                  </Button>
                </div>
              </div>

              <div className="flex justify-center gap-8 opacity-40">
                <Youtube className="w-5 h-5" />
                <Music className="w-5 h-5" />
                <Disc className="w-5 h-5" />
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="player"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col relative z-10"
          >
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              {/* Visualizer / Album Art */}
              <div className="relative mb-12">
                <motion.div
                  animate={{ rotate: isPlaying ? 360 : 0 }}
                  transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                  className="w-64 h-64 sm:w-80 sm:h-80 rounded-full bg-gradient-to-br from-indigo-950 to-purple-950 border-[12px] border-white/5 shadow-[0_0_100px_rgba(79,70,229,0.15)] relative overflow-hidden flex items-center justify-center group"
                >
                  <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=800')] bg-cover bg-center opacity-40 mix-blend-overlay" />
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[#010101] rounded-full border-4 border-white/10 relative z-10 flex items-center justify-center shadow-inner">
                    <div className="w-4 h-4 bg-indigo-500 rounded-full animate-pulse" />
                  </div>
                  {/* Vinyl grooves */}
                  <div className="absolute inset-0 border-[40px] border-black/10 rounded-full" />
                  <div className="absolute inset-0 border-[80px] border-black/5 rounded-full" />
                </motion.div>
                
                <div className="absolute -bottom-4 -right-4 p-4 bg-indigo-600 rounded-2xl shadow-2xl">
                   {isYoutube ? <Youtube className="w-6 h-6 text-white" /> : <Music className="w-6 h-6 text-white" />}
                </div>
              </div>

              {/* Info */}
              <div className="text-center space-y-3 max-w-md">
                <motion.h3 
                  key={metadata.title}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-2xl sm:text-3xl font-black uppercase italic tracking-tighter"
                >
                  {metadata.title}
                </motion.h3>
                <motion.p 
                  key={metadata.artist}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-indigo-400 font-bold uppercase tracking-[0.2em] text-[10px] sm:text-xs"
                >
                  {metadata.artist}
                </motion.p>
              </div>
            </div>

            {/* Controls */}
            <div className="bg-white/[0.02] border-t border-white/10 backdrop-blur-3xl p-6 sm:p-10 space-y-8">
              <div className="max-w-3xl mx-auto space-y-6">
                {/* Progress */}
                <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] font-mono font-bold text-white/30 w-12 text-right">{formatTime(currentTime)}</span>
                    <Slider
                      value={[currentTime]}
                      max={duration || 100}
                      step={1}
                      onValueChange={handleSeek}
                      className="flex-1"
                    />
                    <span className="text-[10px] font-mono font-bold text-white/30 w-12">{formatTime(duration)}</span>
                  </div>
                </div>

                {/* Main Controls */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-1 sm:gap-4 flex-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => skip(-10)}
                      className="h-10 w-10 sm:h-12 sm:w-12 rounded-full text-white/30 hover:text-white hover:bg-white/5"
                    >
                      <Rewind className="w-5 h-5" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-4 sm:gap-8">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => skip(-30)}
                      className="h-12 w-12 rounded-full text-white/30 hover:text-white hover:bg-white/5 hidden sm:flex"
                    >
                      <SkipBack className="w-6 h-6" />
                    </Button>
                    
                    <Button
                      onClick={togglePlay}
                      className="h-20 w-20 sm:h-24 sm:w-24 rounded-[2.5rem] bg-white text-black hover:bg-indigo-500 hover:text-white transition-all shadow-[0_20px_40px_rgba(255,255,255,0.1)] group"
                    >
                      {isPlaying ? (
                        <Pause className="w-10 h-10 fill-current" />
                      ) : (
                        <Play className="w-10 h-10 fill-current ml-2" />
                      )}
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => skip(30)}
                      className="h-12 w-12 rounded-full text-white/30 hover:text-white hover:bg-white/5 hidden sm:flex"
                    >
                      <SkipForward className="w-6 h-6" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-1 sm:gap-4 flex-1 justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => skip(10)}
                      className="h-10 w-10 sm:h-12 sm:w-12 rounded-full text-white/30 hover:text-white hover:bg-white/5"
                    >
                      <FastForward className="w-5 h-5" />
                    </Button>
                  </div>
                </div>

                {/* Secondary Controls */}
                <div className="flex items-center justify-between pt-4 border-t border-white/5">
                  <div className="flex items-center gap-4 group">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleVolumeChange([isMuted ? (volume || 1) : 0])}
                      className="h-10 w-10 rounded-xl text-white/30 hover:text-white hover:bg-white/5"
                    >
                      {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </Button>
                    <div className="w-24 hidden sm:block">
                      <Slider
                        value={[isMuted ? 0 : volume]}
                        max={1}
                        step={0.01}
                        onValueChange={handleVolumeChange}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      onClick={resetPlayer}
                      className="h-10 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    >
                      Stop Session
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Hidden Player Elements */}
            {!isYoutube ? (
              <audio
                ref={audioRef}
                src={source}
                onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
                onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
                onEnded={() => setIsPlaying(false)}
                className="hidden"
              />
            ) : (
              <div id="youtube-player" className="hidden" ref={ytContainerRef} />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <Button
        variant="ghost"
        size="icon"
        onClick={onClose}
        className="absolute top-6 right-6 z-50 h-12 w-12 rounded-2xl bg-white/5 border border-white/10 text-white/30 hover:text-white hover:bg-white/10"
      >
        <X className="w-6 h-6" />
      </Button>
    </div>
  );
}
