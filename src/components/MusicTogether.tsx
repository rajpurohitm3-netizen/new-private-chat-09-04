"use client";

import { useState, useRef, useEffect } from "react";
import ReactPlayer from "react-player";
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  VolumeX, 
  Music, 
  Link as LinkIcon,
  Search,
  Users,
  Disc,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

interface MusicTogetherProps {
  session: any;
  contact?: any; // For party mode
  isInitiator?: boolean;
}

export function MusicTogether({ session, contact, isInitiator = true }: MusicTogetherProps) {
  const [url, setUrl] = useState("");
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [played, setPlayed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(true);
  
  const playerRef = useRef<ReactPlayer>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!contact) return;

    const channelId = [session.user.id, contact.id].sort().join("-");
    const channel = supabase.channel(`music-sync-${channelId}`)
      .on("broadcast", { event: "sync" }, ({ payload }) => {
        if (!isInitiator) {
          if (payload.url !== url) setUrl(payload.url);
          if (payload.playing !== playing) setPlaying(payload.playing);
          if (Math.abs(payload.playedSeconds - (playerRef.current?.getCurrentTime() || 0)) > 2) {
            playerRef.current?.seekTo(payload.playedSeconds, "seconds");
          }
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [contact, session.user.id, isInitiator, url, playing]);

  const handleSync = (data: any) => {
    if (isInitiator && channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "sync",
        payload: {
          url,
          playing,
          playedSeconds: playerRef.current?.getCurrentTime() || 0,
          ...data
        }
      });
    }
  };

  const handlePlayPause = () => {
    const nextState = !playing;
    setPlaying(nextState);
    handleSync({ playing: nextState });
  };

  const handleSeekChange = (value: number[]) => {
    setPlayed(value[0]);
  };

  const handleSeekMouseUp = (value: number[]) => {
    setSeeking(false);
    playerRef.current?.seekTo(value[0]);
    handleSync({ playedSeconds: value[0] });
  };

  const handleProgress = (state: any) => {
    if (!seeking) {
      setPlayed(state.playedSeconds);
    }
  };

  const handleDuration = (dur: number) => {
    setDuration(dur);
  };

  const handleUrlSubmit = () => {
    if (urlInput.trim()) {
      setUrl(urlInput.trim());
      setShowUrlInput(false);
      setPlaying(true);
      handleSync({ url: urlInput.trim(), playing: true });
    }
  };

  const formatTime = (seconds: number) => {
    const date = new Date(seconds * 1000);
    const hh = date.getUTCHours();
    const mm = date.getUTCMinutes();
    const ss = date.getUTCSeconds().toString().padStart(2, "0");
    if (hh) {
      return `${hh}:${mm.toString().padStart(2, "0")}:${ss}`;
    }
    return `${mm}:${ss}`;
  };

  return (
    <div className="flex flex-col h-full bg-[#030303] text-white">
      <AnimatePresence mode="wait">
        {showUrlInput && !url ? (
          <motion.div
            key="url-input"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="flex-1 flex flex-col items-center justify-center p-8 text-center"
          >
            <div className="w-24 h-24 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-[2.5rem] flex items-center justify-center mb-8 shadow-2xl shadow-indigo-500/20">
              <Music className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-3xl font-black uppercase italic tracking-tighter mb-2">Music Together</h2>
            <p className="text-zinc-500 text-sm mb-8 max-w-xs">Paste a YouTube link to start listening synchronized with your partner.</p>
            
            <div className="w-full max-w-md space-y-4">
              <div className="relative group">
                <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-indigo-500 transition-colors" />
                <Input
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="Paste YouTube Link..."
                  className="h-16 bg-zinc-900/50 border-zinc-800 rounded-2xl pl-12 pr-4 focus:ring-2 ring-indigo-500/20 transition-all"
                  onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
                />
              </div>
              <Button 
                onClick={handleUrlSubmit}
                disabled={!urlInput.trim()}
                className="w-full h-16 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] shadow-xl shadow-indigo-900/20"
              >
                Start Session
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="player"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex flex-col relative overflow-hidden"
          >
            {/* Background Aura */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] bg-indigo-600/10 blur-[150px] rounded-full animate-pulse" />
            </div>

            {/* Hidden Player */}
            <div className="hidden">
              <ReactPlayer
                ref={playerRef}
                url={url}
                playing={playing}
                volume={volume}
                muted={muted}
                onProgress={handleProgress}
                onDuration={handleDuration}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
              />
            </div>

            {/* Visualizer / UI */}
            <div className="flex-1 flex flex-col items-center justify-center p-8 relative z-10">
              <div className="relative mb-12">
                <motion.div
                  animate={{ rotate: playing ? 360 : 0 }}
                  transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                  className="w-64 h-64 sm:w-80 sm:h-80 rounded-full border-8 border-zinc-900 shadow-2xl relative overflow-hidden bg-zinc-800"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-purple-500/20" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Disc className="w-32 h-32 text-zinc-900 opacity-20" />
                  </div>
                  {/* Inner ring */}
                  <div className="absolute inset-[35%] rounded-full border-4 border-zinc-900/50 bg-zinc-900 flex items-center justify-center">
                    <div className="w-4 h-4 rounded-full bg-zinc-800 border-2 border-zinc-700" />
                  </div>
                </motion.div>
                
                {/* Visualizer Bars (Simplified) */}
                <div className="absolute -inset-8 flex items-center justify-center gap-1 opacity-40">
                   {[...Array(12)].map((_, i) => (
                     <motion.div
                       key={i}
                       animate={{ 
                         height: playing ? [10, 40, 20, 50, 10] : 10 
                       }}
                       transition={{ 
                         duration: 0.8, 
                         repeat: Infinity, 
                         delay: i * 0.1,
                         ease: "easeInOut" 
                       }}
                       className="w-1.5 bg-indigo-500 rounded-full"
                     />
                   ))}
                </div>
              </div>

              <div className="text-center space-y-2 mb-12">
                <h3 className="text-2xl font-black uppercase italic tracking-tighter">Now Playing</h3>
                <p className="text-indigo-400 font-bold text-sm truncate max-w-xs uppercase tracking-widest">
                  {url.includes("youtube.com") ? "YouTube Stream" : "Audio Track"}
                </p>
              </div>

              {/* Controls */}
              <div className="w-full max-w-md space-y-8">
                <div className="space-y-4">
                  <Slider
                    value={[played]}
                    max={duration}
                    step={1}
                    onValueChange={handleSeekChange}
                    onValueCommit={handleSeekMouseUp}
                    className="cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    <span>{formatTime(played)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-8">
                  <Button variant="ghost" size="icon" className="text-zinc-500 hover:text-white">
                    <SkipBack className="w-6 h-6" />
                  </Button>
                  <Button 
                    onClick={handlePlayPause}
                    size="icon" 
                    className="w-20 h-20 rounded-full bg-white text-black hover:bg-zinc-200 shadow-2xl shadow-white/10"
                  >
                    {playing ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="text-zinc-500 hover:text-white">
                    <SkipForward className="w-6 h-6" />
                  </Button>
                </div>

                <div className="flex items-center gap-4 px-8">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setMuted(!muted)}
                    className="text-zinc-500 hover:text-white"
                  >
                    {muted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </Button>
                  <Slider
                    value={[muted ? 0 : volume]}
                    max={1}
                    step={0.01}
                    onValueChange={(v) => {
                      setVolume(v[0]);
                      setMuted(v[0] === 0);
                    }}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            {/* Bottom Toolbar */}
            <div className="p-6 border-t border-white/5 flex items-center justify-between bg-zinc-900/30 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/10 rounded-xl">
                  <Disc className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                   <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Mode</p>
                   <p className="text-xs font-bold uppercase">{contact ? `Party with ${contact.username}` : "Solo Session"}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setShowUrlInput(true)}
                  className="rounded-xl bg-white/5 hover:bg-white/10"
                >
                  <LinkIcon className="w-4 h-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setUrl("")}
                  className="rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
