"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  SkipBack,
  SkipForward,
  Upload,
  Link,
  Music,
  X,
  Rewind,
  FastForward,
  Youtube,
  Disc,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";

interface MusicTogetherProps {
  onClose?: () => void;
}

export function MusicTogether({ onClose }: MusicTogetherProps) {
  const [source, setSource] = useState<string>("");
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showSetup, setShowSetup] = useState(true);
  const [urlInput, setUrlInput] = useState("");
  const [isYoutube, setIsYoutube] = useState(false);
  const [youtubeId, setYoutubeId] = useState<string | null>(null);

  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ytPlayerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const getYoutubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  useEffect(() => {
    if (youtubeId && !ytPlayerRef.current) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      (window as any).onYouTubeIframeAPIReady = () => {
        ytPlayerRef.current = new (window as any).YT.Player('youtube-player', {
          height: '100%',
          width: '100%',
          videoId: youtubeId,
          playerVars: {
            'autoplay': 1,
            'controls': 0,
            'modestbranding': 1,
            'rel': 0,
          },
          events: {
            'onReady': (event: any) => {
              setDuration(event.target.getDuration());
              setIsPlaying(true);
            },
            'onStateChange': (event: any) => {
              if (event.data === (window as any).YT.PlayerState.PLAYING) setIsPlaying(true);
              if (event.data === (window as any).YT.PlayerState.PAUSED) setIsPlaying(false);
            }
          }
        });
      };

      if ((window as any).YT && (window as any).YT.Player) {
        (window as any).onYouTubeIframeAPIReady();
      }
    }

    return () => {
      if (ytPlayerRef.current) {
        ytPlayerRef.current.destroy();
        ytPlayerRef.current = null;
      }
    };
  }, [youtubeId]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && youtubeId && ytPlayerRef.current) {
      interval = setInterval(() => {
        setCurrentTime(ytPlayerRef.current.getCurrentTime());
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, youtubeId]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLocalFile(file);
      const url = URL.createObjectURL(file);
      setSource(url);
      setIsYoutube(false);
      setShowSetup(false);
    }
  };

  const handleUrlSubmit = () => {
    const trimmedUrl = urlInput.trim();
    if (!trimmedUrl) return;

    const ytId = getYoutubeId(trimmedUrl);
    if (ytId) {
      setIsYoutube(true);
      setYoutubeId(ytId);
      setSource(trimmedUrl);
    } else {
      setIsYoutube(false);
      setSource(trimmedUrl);
    }
    setShowSetup(false);
  };

  const togglePlay = () => {
    if (isYoutube && ytPlayerRef.current) {
      if (isPlaying) {
        ytPlayerRef.current.pauseVideo();
      } else {
        ytPlayerRef.current.playVideo();
      }
      setIsPlaying(!isPlaying);
    } else if (mediaRef.current) {
      if (isPlaying) {
        mediaRef.current.pause();
      } else {
        mediaRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (value: number[]) => {
    if (isYoutube && ytPlayerRef.current) {
      ytPlayerRef.current.seekTo(value[0], true);
    } else if (mediaRef.current) {
      mediaRef.current.currentTime = value[0];
    }
    setCurrentTime(value[0]);
  };

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0]);
    if (isYoutube && ytPlayerRef.current) {
      ytPlayerRef.current.setVolume(value[0] * 100);
    } else if (mediaRef.current) {
      mediaRef.current.volume = value[0];
    }
    setIsMuted(value[0] === 0);
  };

  const resetPlayer = () => {
    if (localFile && source) URL.revokeObjectURL(source);
    setSource("");
    setLocalFile(null);
    setShowSetup(true);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setUrlInput("");
    setIsYoutube(false);
    setYoutubeId(null);
    if (ytPlayerRef.current) {
      ytPlayerRef.current.destroy();
      ytPlayerRef.current = null;
    }
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="h-full flex flex-col bg-[#050505] relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/10 blur-[150px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 blur-[150px] rounded-full" />
      </div>

      <AnimatePresence mode="wait">
        {showSetup ? (
          <motion.div
            key="setup"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="flex-1 flex flex-col items-center justify-center p-6 z-10"
          >
            <div className="w-full max-w-md space-y-10">
              <div className="text-center space-y-4">
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                  className="w-24 h-24 mx-auto bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(99,102,241,0.3)]"
                >
                  <Music className="w-12 h-12 text-white" />
                </motion.div>
                <h2 className="text-4xl font-black uppercase italic tracking-tighter">Music Together</h2>
                <p className="text-xs text-white/40 font-bold uppercase tracking-[0.3em]">Neural Audio Sync</p>
              </div>

              <div className="space-y-6">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="audio/*,video/*"
                  className="hidden"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-20 bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] hover:border-indigo-500/50 rounded-[2rem] text-white font-black uppercase tracking-widest transition-all group"
                >
                  <Upload className="w-6 h-6 mr-4 group-hover:scale-110 transition-transform" />
                  Local Frequency
                </Button>

                <div className="relative flex items-center gap-4">
                  <div className="flex-1 h-px bg-white/5" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/20">Uplink Matrix</span>
                  <div className="flex-1 h-px bg-white/5" />
                </div>

                <div className="space-y-4">
                  <div className="relative">
                    <Youtube className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20" />
                    <Input
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="YouTube or Stream URL..."
                      className="h-16 bg-white/[0.02] border-white/10 rounded-2xl pl-12 pr-4 text-white placeholder:text-white/10 focus:border-indigo-500/50"
                      onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
                    />
                  </div>
                  <Button
                    onClick={handleUrlSubmit}
                    disabled={!urlInput.trim()}
                    className="w-full h-14 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-2xl font-black uppercase tracking-[0.2em] shadow-lg shadow-indigo-600/20"
                  >
                    Initialize Link
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="player"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 relative flex flex-col items-center justify-center p-6 sm:p-12 overflow-hidden"
          >
            {/* Visualizer Background Effect */}
            <div className="absolute inset-0 z-0">
               <motion.div 
                 animate={{ 
                   scale: isPlaying ? [1, 1.2, 1] : 1,
                   opacity: isPlaying ? [0.1, 0.2, 0.1] : 0.05
                 }}
                 transition={{ duration: 2, repeat: Infinity }}
                 className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] bg-indigo-500/20 blur-[120px] rounded-full"
               />
            </div>

            <div className="w-full max-w-4xl z-10 space-y-12">
              <div className="relative aspect-video rounded-[3rem] overflow-hidden bg-black shadow-2xl border border-white/5">
                {isYoutube ? (
                  <div id="youtube-player" className="w-full h-full" />
                ) : (
                  <video
                    ref={mediaRef as any}
                    src={source}
                    className="w-full h-full object-cover"
                    onTimeUpdate={() => setCurrentTime(mediaRef.current?.currentTime || 0)}
                    onLoadedMetadata={() => setDuration(mediaRef.current?.duration || 0)}
                    onEnded={() => setIsPlaying(false)}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    autoPlay
                  />
                )}
                
                {/* Overlay Controls */}
                <div className="absolute top-6 left-6 right-6 flex items-center justify-between">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={resetPlayer}
                    className="h-12 w-12 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 hover:bg-black/60"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                  <div className="bg-black/40 backdrop-blur-xl px-6 py-2 rounded-2xl border border-white/10">
                    <p className="text-[10px] font-black uppercase tracking-widest">
                      {isYoutube ? "YouTube Stream" : localFile?.name || "Local Frequency"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                <div className="space-y-4">
                  <Slider
                    value={[currentTime]}
                    max={duration || 100}
                    step={1}
                    onValueChange={handleSeek}
                    className="cursor-pointer"
                  />
                  <div className="flex justify-between items-center text-[10px] font-black font-mono tracking-widest text-white/30">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-8">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleSeek([Math.max(0, currentTime - 10)])}
                    className="h-14 w-14 rounded-full bg-white/5 hover:bg-white/10"
                  >
                    <Rewind className="w-6 h-6" />
                  </Button>
                  
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={togglePlay}
                    className="h-24 w-24 rounded-[2.5rem] bg-indigo-600 flex items-center justify-center shadow-[0_20px_40px_rgba(79,70,229,0.3)] border border-indigo-400/30"
                  >
                    {isPlaying ? (
                      <Pause className="w-10 h-10 text-white" />
                    ) : (
                      <Play className="w-10 h-10 text-white ml-2" />
                    )}
                  </motion.button>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleSeek([Math.min(duration, currentTime + 10)])}
                    className="h-14 w-14 rounded-full bg-white/5 hover:bg-white/10"
                  >
                    <FastForward className="w-6 h-6" />
                  </Button>
                </div>

                <div className="flex items-center justify-center gap-6">
                  <div className="flex items-center gap-4 bg-white/5 px-6 py-3 rounded-2xl border border-white/5 w-64">
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-5 h-5 text-white/40" />
                    ) : (
                      <Volume2 className="w-5 h-5 text-indigo-400" />
                    )}
                    <Slider
                      value={[isMuted ? 0 : volume]}
                      max={1}
                      step={0.01}
                      onValueChange={handleVolumeChange}
                    />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
