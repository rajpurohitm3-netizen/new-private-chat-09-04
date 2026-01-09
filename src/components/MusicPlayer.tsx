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
  Music,
  X,
  ListMusic,
  Heart,
  Repeat,
  Shuffle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";

interface MusicPlayerProps {
  onClose?: () => void;
}

export function MusicPlayer({ onClose }: MusicPlayerProps) {
  const [audioSource, setAudioSource] = useState<string>("");
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [showSetup, setShowSetup] = useState(true);
  const [urlInput, setUrlInput] = useState("");
  const [isRepeat, setIsRepeat] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLocalFile(file);
      const url = URL.createObjectURL(file);
      setAudioSource(url);
      setShowSetup(false);
    }
  };

  const handleUrlSubmit = () => {
    if (urlInput.trim()) {
      setAudioSource(urlInput.trim());
      setShowSetup(false);
    }
  };

  const togglePlay = () => {
    if (audioRef.current) {
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
    if (localFile && audioSource) {
      URL.revokeObjectURL(audioSource);
    }
    setAudioSource("");
    setLocalFile(null);
    setShowSetup(true);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setUrlInput("");
  };

  useEffect(() => {
    return () => {
      if (localFile && audioSource) {
        URL.revokeObjectURL(audioSource);
      }
    };
  }, [localFile, audioSource]);

  return (
    <div className="h-full flex flex-col bg-[#050505]">
      <AnimatePresence mode="wait">
        {showSetup ? (
          <motion.div
            key="setup"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="flex-1 flex flex-col items-center justify-center p-8"
          >
            <div className="w-full max-w-md space-y-10">
              <div className="text-center space-y-4">
                <div className="w-24 h-24 mx-auto bg-gradient-to-br from-indigo-500 via-blue-500 to-purple-600 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-indigo-500/20 relative group">
                  <div className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-full group-hover:blur-3xl transition-all" />
                  <Music className="w-10 h-10 text-white relative" />
                </div>
                <h2 className="text-4xl font-black uppercase italic tracking-tighter">Music <span className="text-indigo-500">Solo</span></h2>
                <p className="text-xs text-white/30 font-black uppercase tracking-[0.3em]">Pure Auditory Experience</p>
              </div>

              <div className="space-y-4">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="audio/*"
                  className="hidden"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-20 bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] hover:border-indigo-500/50 rounded-[2rem] text-white font-black uppercase tracking-widest transition-all group"
                >
                  <Upload className="w-5 h-5 mr-3 text-indigo-400 group-hover:scale-110 transition-transform" />
                  Upload Local Audio
                </Button>

                <div className="relative flex items-center gap-4 py-4">
                  <div className="flex-1 h-px bg-white/5" />
                  <span className="text-[10px] font-black uppercase tracking-[0.5em] text-white/20">OR</span>
                  <div className="flex-1 h-px bg-white/5" />
                </div>

                <div className="space-y-4">
                  <div className="relative group">
                    <Link className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-indigo-400 transition-colors" />
                    <Input
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="STREAM URL (MP3, WAV, etc.)"
                      className="h-16 bg-white/[0.03] border-white/10 rounded-[1.5rem] pl-14 text-sm font-bold tracking-wider focus:border-indigo-500/50 transition-all"
                      onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
                    />
                  </div>
                  <Button
                    onClick={handleUrlSubmit}
                    disabled={!urlInput.trim()}
                    className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[1.5rem] font-black uppercase tracking-widest shadow-xl shadow-indigo-600/20 disabled:opacity-30 transition-all active:scale-95"
                  >
                    Load Stream
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
            className="flex-1 flex flex-col items-center justify-center p-8 relative overflow-hidden"
          >
            {/* Background Visualizer Effect */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <motion.div 
                    animate={{ 
                        scale: isPlaying ? [1, 1.2, 1] : 1,
                        opacity: isPlaying ? [0.1, 0.2, 0.1] : 0.1
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/20 blur-[120px] rounded-full"
                />
            </div>

            <div className="w-full max-w-lg space-y-12 relative z-10">
                <div className="flex items-center justify-between mb-8">
                    <Button variant="ghost" size="icon" onClick={resetPlayer} className="w-12 h-12 rounded-2xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all">
                        <X className="w-5 h-5" />
                    </Button>
                    <div className="text-center">
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30">Now Playing</p>
                    </div>
                    <Button variant="ghost" size="icon" className="w-12 h-12 rounded-2xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all">
                        <ListMusic className="w-5 h-5" />
                    </Button>
                </div>

                <div className="space-y-12">
                    <div className="relative group">
                        <div className="absolute -inset-10 bg-gradient-to-r from-indigo-600/20 via-purple-600/20 to-pink-600/20 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                        <div className="w-72 h-72 sm:w-80 sm:h-80 mx-auto bg-gradient-to-br from-zinc-800 to-zinc-950 rounded-[3rem] p-1 shadow-2xl relative overflow-hidden ring-1 ring-white/10">
                            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 contrast-150" />
                            <div className="w-full h-full rounded-[2.8rem] bg-zinc-900 flex items-center justify-center relative">
                                <motion.div 
                                    animate={{ 
                                        rotate: isPlaying ? 360 : 0,
                                        scale: isPlaying ? [1, 1.05, 1] : 1
                                    }}
                                    transition={{ 
                                        rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                                        scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
                                    }}
                                    className="w-48 h-48 rounded-full border-4 border-white/5 flex items-center justify-center relative"
                                >
                                    <div className="w-12 h-12 rounded-full bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/40">
                                        <Music className="w-6 h-6 text-white" />
                                    </div>
                                    <div className="absolute inset-0 border-t-4 border-indigo-500 rounded-full opacity-50" />
                                </motion.div>
                            </div>
                        </div>
                    </div>

                    <div className="text-center space-y-2">
                        <motion.h3 
                            layoutId="title"
                            className="text-2xl font-black uppercase italic tracking-tight truncate max-w-md mx-auto"
                        >
                            {localFile?.name || "Streaming Audio"}
                        </motion.h3>
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20">
                            {localFile ? "Local Protocol" : "Network Stream"}
                        </p>
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-3">
                            <Slider
                                value={[currentTime]}
                                max={duration || 100}
                                step={0.1}
                                onValueChange={handleSeek}
                                className="cursor-pointer"
                            />
                            <div className="flex justify-between">
                                <span className="text-[10px] font-black font-mono text-white/30">{formatTime(currentTime)}</span>
                                <span className="text-[10px] font-black font-mono text-white/30">{formatTime(duration)}</span>
                            </div>
                        </div>

                        <div className="flex items-center justify-center gap-10">
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => setIsShuffle(!isShuffle)}
                                className={`w-10 h-10 rounded-full transition-all ${isShuffle ? 'text-indigo-400 bg-indigo-400/10' : 'text-white/20'}`}
                            >
                                <Shuffle className="w-4 h-4" />
                            </Button>
                            
                            <div className="flex items-center gap-6">
                                <Button variant="ghost" size="icon" className="w-12 h-12 rounded-full text-white/40 hover:text-white hover:bg-white/5">
                                    <SkipBack className="w-6 h-6 fill-current" />
                                </Button>
                                
                                <motion.button
                                    whileTap={{ scale: 0.9 }}
                                    onClick={togglePlay}
                                    className="w-24 h-24 rounded-full bg-white text-black flex items-center justify-center shadow-2xl shadow-white/10 hover:scale-105 transition-all"
                                >
                                    {isPlaying ? (
                                        <Pause className="w-10 h-10 fill-current" />
                                    ) : (
                                        <Play className="w-10 h-10 fill-current ml-2" />
                                    )}
                                </motion.button>

                                <Button variant="ghost" size="icon" className="w-12 h-12 rounded-full text-white/40 hover:text-white hover:bg-white/5">
                                    <SkipForward className="w-6 h-6 fill-current" />
                                </Button>
                            </div>

                            <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => setIsRepeat(!isRepeat)}
                                className={`w-10 h-10 rounded-full transition-all ${isRepeat ? 'text-indigo-400 bg-indigo-400/10' : 'text-white/20'}`}
                            >
                                <Repeat className="w-4 h-4" />
                            </Button>
                        </div>

                        <div className="flex items-center justify-center gap-6 pt-4">
                            <Button variant="ghost" size="icon" className="text-white/20 hover:text-pink-500 transition-colors">
                                <Heart className="w-5 h-5" />
                            </Button>
                            <div className="flex items-center gap-3 w-40">
                                <Button variant="ghost" size="icon" onClick={toggleMute} className="text-white/30 hover:text-white shrink-0">
                                    {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                                </Button>
                                <Slider
                                    value={[isMuted ? 0 : volume]}
                                    max={1}
                                    step={0.01}
                                    onValueChange={handleVolumeChange}
                                />
                            </div>
                            <Button variant="ghost" size="icon" className="text-white/20">
                                <Plus className="w-5 h-5" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <audio
              ref={audioRef}
              src={audioSource}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={() => {
                  if (isRepeat) {
                      if (audioRef.current) {
                          audioRef.current.currentTime = 0;
                          audioRef.current.play();
                      }
                  } else {
                      setIsPlaying(false);
                  }
              }}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
