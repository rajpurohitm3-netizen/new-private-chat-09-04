"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  SkipBack,
  SkipForward,
  Upload,
  Link,
  Music as MusicIcon,
  X,
  Repeat,
  Shuffle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";

interface MusicSoloProps {
  onClose?: () => void;
}

export function MusicSolo({ onClose }: MusicSoloProps) {
  const [audioSource, setAudioSource] = useState<string>("");
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showSetup, setShowSetup] = useState(true);
  const [urlInput, setUrlInput] = useState("");
  const [isYoutube, setIsYoutube] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getYoutubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLocalFile(file);
      const url = URL.createObjectURL(file);
      setAudioSource(url);
      setIsYoutube(false);
      setShowSetup(false);
    }
  };

  const handleUrlSubmit = () => {
    if (urlInput.trim()) {
      const ytId = getYoutubeId(urlInput.trim());
      if (ytId) {
        setIsYoutube(true);
        setAudioSource(`https://www.youtube.com/embed/${ytId}?autoplay=1&enablejsapi=1`);
      } else {
        setIsYoutube(false);
        setAudioSource(urlInput.trim());
      }
      setShowSetup(false);
    }
  };

  const togglePlay = () => {
    if (audioRef.current && !isYoutube) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.volume = value[0];
      setVolume(value[0]);
      setIsMuted(value[0] === 0);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const resetPlayer = () => {
    if (localFile && audioSource && !isYoutube) {
      URL.revokeObjectURL(audioSource);
    }
    setAudioSource("");
    setLocalFile(null);
    setShowSetup(true);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setUrlInput("");
    setIsYoutube(false);
  };

  useEffect(() => {
    if (!isYoutube && audioSource && audioRef.current) {
        // Handle Media Session API
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: localFile?.name || 'Remote Audio',
                artist: 'Chatify Music',
                album: 'Uplink Sessions',
                artwork: [
                    { src: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=1000&auto=format&fit=crop', sizes: '512x512', type: 'image/jpeg' }
                ]
            });

            navigator.mediaSession.setActionHandler('play', () => {
                audioRef.current?.play();
                setIsPlaying(true);
            });
            navigator.mediaSession.setActionHandler('pause', () => {
                audioRef.current?.pause();
                setIsPlaying(false);
            });
            navigator.mediaSession.setActionHandler('seekbackward', () => {
                if (audioRef.current) audioRef.current.currentTime -= 10;
            });
            navigator.mediaSession.setActionHandler('seekforward', () => {
                if (audioRef.current) audioRef.current.currentTime += 10;
            });
        }
    }
  }, [audioSource, isYoutube, localFile]);

  return (
    <div className="h-full flex flex-col bg-[#030303]">
      <AnimatePresence mode="wait">
        {showSetup ? (
          <motion.div
            key="setup"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex-1 flex flex-col items-center justify-center p-6"
          >
            <div className="w-full max-w-md space-y-10">
              <div className="text-center space-y-4">
                <div className="w-24 h-24 mx-auto bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-[2rem] flex items-center justify-center mb-8 shadow-2xl shadow-indigo-500/20 relative group">
                    <div className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                    <MusicIcon className="w-12 h-12 text-white relative z-10" />
                </div>
                <h2 className="text-4xl font-black uppercase italic tracking-tighter">Music <span className="text-indigo-500">Solo</span></h2>
                <p className="text-xs font-bold uppercase tracking-[0.3em] text-white/30">High-Fidelity Audio Matrix</p>
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
                  className="w-full h-20 bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] hover:border-white/20 rounded-[1.5rem] text-white font-black uppercase tracking-[0.2em] text-[10px] transition-all group"
                >
                  <Upload className="w-5 h-5 mr-4 text-indigo-400 group-hover:scale-110 transition-transform" />
                  Load Local MP3/FLAC
                </Button>

                <div className="relative flex items-center gap-4">
                  <div className="flex-1 h-px bg-white/5" />
                  <span className="text-[9px] font-black uppercase tracking-[0.5em] text-white/10">Signal Bypass</span>
                  <div className="flex-1 h-px bg-white/5" />
                </div>

                <div className="space-y-4">
                  <div className="relative">
                    <Link className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                    <Input
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="YouTube Link or Audio URL..."
                      className="h-16 bg-white/[0.03] border-white/10 rounded-2xl pl-12 text-white placeholder:text-white/20 text-xs focus:ring-1 ring-indigo-500/50"
                      onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
                    />
                  </div>
                  <Button
                    onClick={handleUrlSubmit}
                    disabled={!urlInput.trim()}
                    className="w-full h-14 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] shadow-lg shadow-indigo-600/20 disabled:opacity-30 transition-all"
                  >
                    Establish Stream
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
            className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden"
          >
            {/* Background Visualizer Effect */}
            <div className="absolute inset-0 pointer-events-none">
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/10 blur-[120px] rounded-full transition-all duration-1000 ${isPlaying ? 'scale-110 opacity-30' : 'scale-90 opacity-10'}`} />
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-purple-500/10 blur-[100px] rounded-full transition-all duration-1000 delay-300 ${isPlaying ? 'scale-125 opacity-20' : 'scale-95 opacity-5'}`} />
            </div>

            <div className="w-full max-w-lg z-10 space-y-12">
                <div className="flex justify-between items-center mb-8">
                    <Button variant="ghost" size="icon" onClick={resetPlayer} className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white/40 hover:text-white">
                        <X className="w-5 h-5" />
                    </Button>
                    <div className="text-center">
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-500 mb-1">Source Active</p>
                        <p className="text-xs font-bold text-white/60 uppercase tracking-widest truncate max-w-[200px]">
                            {localFile?.name || "Neural Stream"}
                        </p>
                    </div>
                    <Button variant="ghost" size="icon" className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 text-white/20">
                        <MusicIcon className="w-5 h-5" />
                    </Button>
                </div>

                {isYoutube ? (
                    <div className="aspect-video w-full rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl bg-black">
                        <iframe
                            src={audioSource}
                            className="w-full h-full"
                            allow="autoplay; encrypted-media"
                            allowFullScreen
                        />
                    </div>
                ) : (
                    <div className="flex flex-col items-center space-y-12">
                        {/* Vinyl Visualizer */}
                        <div className="relative">
                            <motion.div 
                                animate={{ rotate: isPlaying ? 360 : 0 }}
                                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                                className="w-64 h-64 rounded-full bg-[#111] border-[12px] border-zinc-900 shadow-2xl relative flex items-center justify-center overflow-hidden"
                            >
                                <div className="absolute inset-0 opacity-20 bg-[repeating-radial-gradient(circle_at_center,#000,#000_2px,#111_2px,#111_4px)]" />
                                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center border-4 border-zinc-900 z-10 shadow-xl">
                                    <MusicIcon className="w-8 h-8 text-white" />
                                </div>
                            </motion.div>
                            <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-indigo-500 rounded-full flex items-center justify-center border-4 border-[#030303] shadow-lg">
                                <div className="w-2 h-2 bg-white rounded-full animate-ping" />
                            </div>
                        </div>

                        <div className="w-full space-y-6">
                            <div className="space-y-2">
                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-white/20 px-1">
                                    <span>{formatTime(currentTime)}</span>
                                    <span>{formatTime(duration)}</span>
                                </div>
                                <Slider
                                    value={[currentTime]}
                                    max={duration || 100}
                                    step={0.1}
                                    onValueChange={handleSeek}
                                    className="cursor-pointer"
                                />
                            </div>

                            <div className="flex items-center justify-center gap-10">
                                <Button variant="ghost" size="icon" className="text-white/20 hover:text-white">
                                    <Shuffle className="w-5 h-5" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => { if(audioRef.current) audioRef.current.currentTime -= 10 }} className="text-white/40 hover:text-white">
                                    <SkipBack className="w-6 h-6 fill-current" />
                                </Button>
                                <Button
                                    onClick={togglePlay}
                                    className="w-20 h-20 rounded-full bg-white text-black hover:scale-105 transition-all shadow-xl shadow-white/10 flex items-center justify-center"
                                >
                                    {isPlaying ? (
                                        <Pause className="w-8 h-8 fill-current" />
                                    ) : (
                                        <Play className="w-8 h-8 fill-current ml-1" />
                                    )}
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => { if(audioRef.current) audioRef.current.currentTime += 10 }} className="text-white/40 hover:text-white">
                                    <SkipForward className="w-6 h-6 fill-current" />
                                </Button>
                                <Button variant="ghost" size="icon" className="text-white/20 hover:text-white">
                                    <Repeat className="w-5 h-5" />
                                </Button>
                            </div>

                            <div className="flex items-center gap-4 justify-center pt-6">
                                <Button variant="ghost" size="icon" onClick={toggleMute} className="text-white/40 hover:text-white">
                                    {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                                </Button>
                                <div className="w-32">
                                    <Slider
                                        value={[isMuted ? 0 : volume]}
                                        max={1}
                                        step={0.01}
                                        onValueChange={handleVolumeChange}
                                    />
                                </div>
                            </div>
                        </div>

                        <audio
                            ref={audioRef}
                            src={audioSource}
                            onTimeUpdate={handleTimeUpdate}
                            onLoadedMetadata={handleLoadedMetadata}
                            onEnded={() => setIsPlaying(false)}
                            onPlay={() => setIsPlaying(true)}
                            onPause={() => setIsPlaying(false)}
                        />
                    </div>
                )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
