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
  Disc,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import ReactPlayer from "react-player";

interface MusicSoloProps {
  onClose?: () => void;
}

export function MusicSolo({ onClose }: MusicSoloProps) {
  const [source, setSource] = useState<string>("");
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showSetup, setShowSetup] = useState(true);
  const [urlInput, setUrlInput] = useState("");

  const playerRef = useRef<ReactPlayer>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLocalFile(file);
      const url = URL.createObjectURL(file);
      setSource(url);
      setShowSetup(false);
      updateMediaSession(file.name);
    }
  };

  const handleUrlSubmit = () => {
    if (urlInput.trim()) {
      setSource(urlInput.trim());
      setShowSetup(false);
      updateMediaSession("YouTube Stream");
    }
  };

  const updateMediaSession = (title: string) => {
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: title,
        artist: "Chatify Music",
        album: "Solo Stream",
        artwork: [
          { src: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=500&q=80", sizes: "512x512", type: "image/jpeg" }
        ]
      });

      navigator.mediaSession.setActionHandler("play", () => setIsPlaying(true));
      navigator.mediaSession.setActionHandler("pause", () => setIsPlaying(false));
      navigator.mediaSession.setActionHandler("seekbackward", () => skip(-10));
      navigator.mediaSession.setActionHandler("seekforward", () => skip(10));
    }
  };

  const togglePlay = () => setIsPlaying(!isPlaying);

  const handleProgress = (state: { playedSeconds: number }) => {
    setCurrentTime(state.playedSeconds);
  };

  const handleDuration = (dur: number) => {
    setDuration(dur);
  };

  const handleSeek = (value: number[]) => {
    playerRef.current?.seekTo(value[0]);
    setCurrentTime(value[0]);
  };

  const skip = (seconds: number) => {
    playerRef.current?.seekTo(currentTime + seconds);
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const resetPlayer = () => {
    if (localFile && source.startsWith("blob:")) {
      URL.revokeObjectURL(source);
    }
    setSource("");
    setLocalFile(null);
    setShowSetup(true);
    setIsPlaying(false);
    setCurrentTime(0);
    setUrlInput("");
  };

  return (
    <div className="h-full flex flex-col bg-[#030303]">
      <AnimatePresence mode="wait">
        {showSetup ? (
          <motion.div
            key="setup"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex-1 flex flex-col items-center justify-center p-6"
          >
            <div className="w-full max-w-md space-y-8 bg-zinc-900/50 p-10 rounded-[2.5rem] border border-white/5 backdrop-blur-xl">
              <div className="text-center space-y-4">
                <div className="w-24 h-24 mx-auto bg-gradient-to-br from-pink-500 to-violet-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-pink-500/20">
                  <Music className="w-12 h-12 text-white" />
                </div>
                <h2 className="text-3xl font-black uppercase italic tracking-tighter">Music Solo</h2>
                <p className="text-xs text-white/40 font-bold uppercase tracking-[0.2em]">Upload audio or paste YouTube link</p>
              </div>

              <div className="space-y-4">
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="audio/*" className="hidden" />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-16 bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] rounded-2xl text-white font-black uppercase tracking-widest text-[10px] transition-all"
                >
                  <Upload className="w-4 h-4 mr-3 text-pink-500" />
                  Select Audio File
                </Button>

                <div className="relative flex items-center gap-4 py-2">
                  <div className="flex-1 h-px bg-white/5" />
                  <span className="text-[8px] font-black uppercase tracking-widest text-white/20">or</span>
                  <div className="flex-1 h-px bg-white/5" />
                </div>

                <div className="space-y-3">
                  <div className="relative">
                    <Link className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                    <Input
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="YouTube URL..."
                      className="h-14 bg-white/5 border-white/10 rounded-2xl pl-12 text-sm focus:border-pink-500/50 transition-all"
                      onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
                    />
                  </div>
                  <Button
                    onClick={handleUrlSubmit}
                    disabled={!urlInput.trim()}
                    className="w-full h-12 bg-gradient-to-r from-pink-600 to-violet-600 hover:opacity-90 rounded-2xl font-black uppercase tracking-widest text-[10px] disabled:opacity-30"
                  >
                    Play Stream
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
            className="flex-1 flex flex-col p-6 relative"
          >
            <div className="flex-1 flex flex-col items-center justify-center space-y-12">
              <motion.div
                animate={{ rotate: isPlaying ? 360 : 0 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                className="relative"
              >
                <div className="w-64 h-64 sm:w-80 sm:h-80 rounded-full bg-zinc-900 border-8 border-zinc-800 flex items-center justify-center shadow-[0_0_100px_rgba(219,39,119,0.15)] overflow-hidden">
                   <div className="absolute inset-0 bg-gradient-to-br from-pink-500/10 via-transparent to-violet-600/10" />
                   <Disc className="w-40 h-40 text-white/5" />
                   <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-20 h-20 rounded-full bg-zinc-950 border-4 border-zinc-800 z-10" />
                   </div>
                </div>
                {/* Vinyl Grooves Effect */}
                <div className="absolute inset-0 rounded-full border border-white/5 pointer-events-none" />
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="absolute inset-0 rounded-full border border-white/5 pointer-events-none" style={{ margin: `${(i+1)*15}px` }} />
                ))}
              </motion.div>

              <div className="w-full max-w-md text-center space-y-2">
                 <h3 className="text-xl font-black uppercase italic tracking-tight truncate px-4">
                    {localFile?.name || "Streaming Audio"}
                 </h3>
                 <p className="text-[10px] font-bold text-pink-500 uppercase tracking-[0.3em]">
                    {isPlaying ? "Playing Now" : "Paused"}
                 </p>
              </div>

              <div className="w-full max-w-md space-y-8">
                <div className="space-y-2">
                    <Slider
                      value={[currentTime]}
                      max={duration || 100}
                      step={0.1}
                      onValueChange={handleSeek}
                      className="cursor-pointer"
                    />
                    <div className="flex justify-between">
                        <span className="text-[10px] font-mono text-white/30">{formatTime(currentTime)}</span>
                        <span className="text-[10px] font-mono text-white/30">{formatTime(duration)}</span>
                    </div>
                </div>

                <div className="flex items-center justify-center gap-8">
                    <Button variant="ghost" size="icon" onClick={() => skip(-10)} className="h-12 w-12 rounded-full hover:bg-white/5 text-white/40">
                        <Rewind className="w-6 h-6" />
                    </Button>
                    <Button onClick={togglePlay} className="h-20 w-20 rounded-full bg-white text-black hover:scale-105 transition-all shadow-2xl">
                        {isPlaying ? <Pause className="w-10 h-10 fill-current" /> : <Play className="w-10 h-10 fill-current ml-1" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => skip(10)} className="h-12 w-12 rounded-full hover:bg-white/5 text-white/40">
                        <FastForward className="w-6 h-6" />
                    </Button>
                </div>

                <div className="flex items-center justify-center gap-4 pt-4">
                    <Button variant="ghost" size="icon" onClick={() => setIsMuted(!isMuted)} className="text-white/20 hover:text-white">
                        {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </Button>
                    <div className="w-32">
                        <Slider value={[isMuted ? 0 : volume]} max={1} step={0.01} onValueChange={(v) => { setVolume(v[0]); setIsMuted(v[0] === 0); }} />
                    </div>
                </div>
              </div>
            </div>

            <Button
                variant="ghost"
                size="icon"
                onClick={resetPlayer}
                className="absolute top-6 right-6 h-12 w-12 rounded-full bg-white/5 hover:bg-white/10 text-white/40"
            >
                <X className="w-5 h-5" />
            </Button>

            <div className="hidden">
              <ReactPlayer
                ref={playerRef}
                url={source}
                playing={isPlaying}
                volume={volume}
                muted={isMuted}
                onProgress={handleProgress}
                onDuration={handleDuration}
                onEnded={() => setIsPlaying(false)}
                height={0}
                width={0}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
