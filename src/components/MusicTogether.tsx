"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactPlayer from "react-player";
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
  Mic2,
  Disc,
  Headphones
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
  const [playbackRate, setPlaybackRate] = useState(1);

  const playerRef = useRef<ReactPlayer>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLocalFile(file);
      const url = URL.createObjectURL(file);
      setSource(url);
      setShowSetup(false);
    }
  };

  const handleUrlSubmit = () => {
    if (urlInput.trim()) {
      setSource(urlInput.trim());
      setShowSetup(false);
    }
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const handleProgress = (state: { playedSeconds: number }) => {
    setCurrentTime(state.playedSeconds);
  };

  const handleDuration = (d: number) => {
    setDuration(d);
  };

  const handleSeek = (value: number[]) => {
    playerRef.current?.seekTo(value[0]);
    setCurrentTime(value[0]);
  };

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0]);
    setIsMuted(value[0] === 0);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const skip = (seconds: number) => {
    const newTime = currentTime + seconds;
    playerRef.current?.seekTo(newTime);
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const resetPlayer = () => {
    if (localFile && source) {
      URL.revokeObjectURL(source);
    }
    setSource("");
    setLocalFile(null);
    setShowSetup(true);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setUrlInput("");
  };

  useEffect(() => {
    return () => {
      if (localFile && source) {
        URL.revokeObjectURL(source);
      }
    };
  }, [localFile, source]);

  return (
    <div className="h-full flex flex-col bg-[#050505] rounded-3xl overflow-hidden border border-white/5 shadow-2xl">
      <AnimatePresence mode="wait">
        {showSetup ? (
          <motion.div
            key="setup"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="flex-1 flex flex-col items-center justify-center p-8 text-center"
          >
            <div className="w-full max-w-md space-y-10">
              <div className="space-y-4">
                <div className="relative mx-auto w-24 h-24">
                  <div className="absolute inset-0 bg-pink-500 blur-[40px] opacity-20 animate-pulse" />
                  <div className="relative w-24 h-24 bg-gradient-to-br from-pink-600 to-rose-600 rounded-[2.5rem] flex items-center justify-center shadow-2xl">
                    <Music className="w-10 h-10 text-white" />
                  </div>
                </div>
                <h2 className="text-4xl font-black uppercase italic tracking-tighter">Music Together</h2>
                <p className="text-xs text-white/30 uppercase tracking-[0.3em] font-bold">Sonic Synchronization</p>
              </div>

              <div className="space-y-4">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="audio/*,video/*"
                  className="hidden"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-16 bg-white/[0.03] border border-white/10 hover:bg-white/[0.08] hover:border-pink-500/30 rounded-2xl text-white font-black uppercase tracking-widest transition-all group"
                >
                  <Upload className="w-5 h-5 mr-3 group-hover:text-pink-400 transition-colors" />
                  Upload Local Audio
                </Button>

                <div className="relative flex items-center gap-4">
                  <div className="flex-1 h-px bg-white/5" />
                  <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20">Uplink</span>
                  <div className="flex-1 h-px bg-white/5" />
                </div>

                <div className="space-y-3">
                  <div className="relative">
                    <Link className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                    <Input
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="YouTube, SoundCloud or MP3 Link..."
                      className="h-14 bg-white/[0.02] border-white/10 rounded-2xl pl-12 text-sm placeholder:text-white/20 focus:border-pink-500/50 transition-all"
                      onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
                    />
                  </div>
                  <Button
                    onClick={handleUrlSubmit}
                    disabled={!urlInput.trim()}
                    className="w-full h-12 bg-gradient-to-r from-pink-600 to-rose-600 hover:opacity-90 rounded-2xl font-black uppercase tracking-widest disabled:opacity-30"
                  >
                    Load Stream
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-center gap-8 pt-4">
                <div className="flex flex-col items-center gap-2">
                    <Headphones className="w-4 h-4 text-white/10" />
                    <span className="text-[8px] font-black uppercase tracking-widest text-white/20">Hi-Fi</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                    <Mic2 className="w-4 h-4 text-white/10" />
                    <span className="text-[8px] font-black uppercase tracking-widest text-white/20">Low Latency</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                    <Disc className="w-4 h-4 text-white/10" />
                    <span className="text-[8px] font-black uppercase tracking-widest text-white/20">Universal</span>
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
            className="flex-1 flex flex-col relative"
          >
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-br from-pink-600/5 via-transparent to-rose-600/5" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] aspect-square bg-pink-500/5 blur-[120px] rounded-full animate-pulse" />
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-8 z-10">
                <div className="relative">
                    <motion.div 
                        animate={{ 
                            rotate: isPlaying ? 360 : 0,
                            scale: isPlaying ? [1, 1.02, 1] : 1
                        }}
                        transition={{ 
                            rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                            scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
                        }}
                        className="w-48 h-48 sm:w-64 sm:h-64 rounded-full border-8 border-white/5 bg-gradient-to-br from-zinc-900 to-black flex items-center justify-center shadow-[0_0_100px_rgba(219,39,119,0.1)] relative"
                    >
                        <div className="absolute inset-4 rounded-full border-2 border-white/5 border-dashed animate-spin-slow" />
                        <Disc className={`w-20 h-20 sm:w-24 sm:h-24 ${isPlaying ? 'text-pink-500' : 'text-white/20'} transition-colors duration-1000`} />
                        
                        <div className="absolute -bottom-2 -right-2 w-16 h-16 bg-zinc-900 rounded-2xl border border-white/10 flex items-center justify-center shadow-xl">
                            {ReactPlayer.canPlay(source) ? (
                                source.includes('youtube.com') || source.includes('youtu.be') ? (
                                    <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center text-[10px] font-black text-white">YT</div>
                                ) : (
                                    <Music className="w-8 h-8 text-pink-500" />
                                )
                            ) : (
                                <Disc className="w-8 h-8 text-white/40" />
                            )}
                        </div>
                    </motion.div>
                    
                    {/* Visualizer bars mock */}
                    <div className="absolute -inset-10 flex items-center justify-between pointer-events-none opacity-20">
                        {[...Array(12)].map((_, i) => (
                            <motion.div
                                key={i}
                                animate={{ height: isPlaying ? [10, 40, 10] : 10 }}
                                transition={{ duration: 0.5 + Math.random(), repeat: Infinity, delay: Math.random() }}
                                className="w-1 bg-pink-500 rounded-full"
                            />
                        ))}
                    </div>
                </div>

                <div className="mt-12 text-center space-y-2 max-w-md">
                    <h3 className="text-xl font-black uppercase italic tracking-tight truncate">
                        {localFile?.name || (source.includes('youtube') ? "YouTube Stream" : "Audio Link")}
                    </h3>
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30">
                        {isPlaying ? "Synchronized Stream Active" : "Stream Paused"}
                    </p>
                </div>

                <div className="w-full max-w-md mt-12 space-y-8">
                    <div className="space-y-3">
                        <div className="flex items-center gap-4">
                            <span className="text-[10px] font-mono text-white/40 w-12 text-right">{formatTime(currentTime)}</span>
                            <Slider
                                value={[currentTime]}
                                max={duration || 100}
                                step={0.1}
                                onValueChange={handleSeek}
                                className="flex-1"
                            />
                            <span className="text-[10px] font-mono text-white/40 w-12">{formatTime(duration)}</span>
                        </div>
                        
                        <div className="flex items-center justify-center gap-10">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => skip(-10)}
                                className="h-12 w-12 rounded-full text-white/40 hover:text-white hover:bg-white/5"
                            >
                                <Rewind className="w-6 h-6" />
                            </Button>
                            
                            <Button
                                onClick={togglePlay}
                                className="h-20 w-20 rounded-full bg-white text-black hover:scale-105 active:scale-95 transition-all shadow-2xl"
                            >
                                {isPlaying ? (
                                    <Pause className="w-8 h-8 fill-black" />
                                ) : (
                                    <Play className="w-8 h-8 fill-black ml-1" />
                                )}
                            </Button>
                            
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => skip(10)}
                                className="h-12 w-12 rounded-full text-white/40 hover:text-white hover:bg-white/5"
                            >
                                <FastForward className="w-6 h-6" />
                            </Button>
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-white/5">
                        <div className="flex items-center gap-4 flex-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={toggleMute}
                                className="h-10 w-10 rounded-xl text-white/40 hover:text-white"
                            >
                                {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                            </Button>
                            <div className="w-24">
                                <Slider
                                    value={[isMuted ? 0 : volume]}
                                    max={1}
                                    step={0.01}
                                    onValueChange={handleVolumeChange}
                                />
                            </div>
                        </div>

                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={resetPlayer}
                            className="h-10 w-10 rounded-xl text-white/40 hover:text-red-400 hover:bg-red-500/10"
                        >
                            <X className="w-5 h-5" />
                        </Button>
                    </div>
                </div>
            </div>

            <div className="hidden">
                <ReactPlayer
                    ref={playerRef}
                    url={source}
                    playing={isPlaying}
                    volume={volume}
                    muted={isMuted}
                    playbackRate={playbackRate}
                    onProgress={handleProgress}
                    onDuration={handleDuration}
                    onEnded={() => setIsPlaying(false)}
                />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
