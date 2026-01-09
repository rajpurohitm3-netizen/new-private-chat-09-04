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
  Disc,
  ListMusic,
  Heart,
  Shuffle,
  Repeat,
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
  const [isLiked, setIsLiked] = useState(false);

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
    <div className="h-full flex flex-col bg-[#030303]">
      <AnimatePresence mode="wait">
        {showSetup ? (
          <motion.div
            key="setup"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex-1 flex flex-col items-center justify-center p-6"
          >
            <div className="w-full max-w-md space-y-8">
              <div className="text-center space-y-2">
                <div className="w-24 h-24 mx-auto bg-gradient-to-br from-pink-600 to-rose-600 rounded-full flex items-center justify-center mb-6 shadow-[0_0_50px_rgba(225,29,72,0.3)] animate-pulse">
                  <Music className="w-12 h-12 text-white" />
                </div>
                <h2 className="text-4xl font-black uppercase italic tracking-tighter">Music Solo</h2>
                <p className="text-sm text-white/30 tracking-widest uppercase">Immerse yourself in sound</p>
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
                  className="w-full h-16 bg-white/[0.03] border border-white/10 hover:bg-white/[0.08] hover:border-pink-500/50 rounded-2xl text-white font-bold uppercase tracking-[0.2em] transition-all group"
                >
                  <Upload className="w-5 h-5 mr-3 group-hover:text-pink-500 transition-colors" />
                  Upload Track
                </Button>

                <div className="relative flex items-center gap-3 py-4">
                  <div className="flex-1 h-px bg-white/5" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/10">Matrix Stream</span>
                  <div className="flex-1 h-px bg-white/5" />
                </div>

                <div className="space-y-3">
                  <div className="relative">
                    <Link className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                    <Input
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="Paste audio URL (MP3, FLAC, WAV)..."
                      className="h-14 bg-white/[0.02] border-white/10 rounded-2xl pl-12 text-white placeholder:text-white/20 focus:border-pink-500/50 transition-all"
                      onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
                    />
                  </div>
                  <Button
                    onClick={handleUrlSubmit}
                    disabled={!urlInput.trim()}
                    className="w-full h-12 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 rounded-xl font-black uppercase tracking-widest disabled:opacity-30 transition-all"
                  >
                    Initialize Stream
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
            className="flex-1 flex flex-col p-6 sm:p-12 relative overflow-hidden"
          >
            <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] bg-pink-600/10 blur-[200px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-20%] w-[80%] h-[80%] bg-rose-600/10 blur-[200px] rounded-full pointer-events-none" />

            <div className="flex items-center justify-between mb-12 relative z-10">
              <Button variant="ghost" onClick={resetPlayer} className="text-white/30 hover:text-white hover:bg-white/5 rounded-2xl px-6 h-12">
                <X className="w-5 h-5 mr-2" /> <span className="text-xs font-black uppercase tracking-widest">Eject</span>
              </Button>
              <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full">
                <div className="w-2 h-2 bg-pink-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">Processing Signal</span>
              </div>
              <Button variant="ghost" size="icon" className="text-white/30 hover:text-white"><ListMusic className="w-6 h-6" /></Button>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center relative z-10">
              <motion.div 
                animate={{ rotate: isPlaying ? 360 : 0 }}
                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                className="relative"
              >
                <div className="w-64 h-64 sm:w-80 sm:h-80 rounded-full bg-gradient-to-br from-zinc-800 to-black p-1 shadow-[0_0_100px_rgba(0,0,0,0.5)] border-4 border-white/5 relative flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 contrast-150" />
                    <Disc className="w-full h-full text-white/5" />
                    <div className="absolute w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur-sm overflow-hidden">
                         <Music className={`w-10 h-10 ${isPlaying ? 'text-pink-500 animate-pulse' : 'text-white/20'}`} />
                    </div>
                </div>
              </motion.div>

              <div className="mt-12 text-center space-y-2 max-w-md">
                <h3 className="text-2xl font-black uppercase italic tracking-tighter truncate px-4">
                  {localFile?.name?.replace(/\.[^/.]+$/, "") || "Digital Stream"}
                </h3>
                <p className="text-xs font-bold uppercase tracking-[0.4em] text-pink-500/70">Secure Node Playback</p>
              </div>

              <div className="mt-12 w-full max-w-xl space-y-8 bg-white/[0.03] border border-white/10 p-8 rounded-[3rem] backdrop-blur-2xl">
                <div className="space-y-4">
                  <Slider
                    value={[currentTime]}
                    max={duration || 100}
                    step={0.1}
                    onValueChange={handleSeek}
                    className="w-full"
                  />
                  <div className="flex justify-between text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                   <Button variant="ghost" size="icon" onClick={() => setIsLiked(!isLiked)} className={isLiked ? "text-pink-500" : "text-white/20"}>
                    <Heart className={`w-6 h-6 ${isLiked ? 'fill-current' : ''}`} />
                   </Button>
                   
                   <div className="flex items-center gap-6 sm:gap-10">
                    <Button variant="ghost" size="icon" className="text-white/30 hover:text-white"><Shuffle className="w-5 h-5" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { if(audioRef.current) audioRef.current.currentTime = 0 }} className="text-white/50 hover:text-white"><SkipBack className="w-8 h-8 fill-current" /></Button>
                    
                    <Button 
                      onClick={togglePlay}
                      className="h-20 w-20 rounded-full bg-white text-black hover:scale-105 transition-transform shadow-[0_0_50px_rgba(255,255,255,0.2)]"
                    >
                      {isPlaying ? <Pause className="w-10 h-10 fill-current" /> : <Play className="w-10 h-10 fill-current ml-1" />}
                    </Button>

                    <Button variant="ghost" size="icon" onClick={() => { if(audioRef.current) audioRef.current.currentTime = duration }} className="text-white/50 hover:text-white"><SkipForward className="w-8 h-8 fill-current" /></Button>
                    <Button variant="ghost" size="icon" className="text-white/30 hover:text-white"><Repeat className="w-5 h-5" /></Button>
                   </div>

                   <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={toggleMute} className="text-white/30 hover:text-white">
                        {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </Button>
                    <div className="w-24 hidden md:block">
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
