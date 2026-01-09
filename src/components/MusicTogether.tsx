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
  Mic,
  MicOff,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { AvatarDisplay } from "@/components/AvatarDisplay";
import Peer from "simple-peer";

interface MusicTogetherProps {
  userId: string;
  privateKey: CryptoKey;
  contact: any;
  isInitiator: boolean;
  incomingSignal?: any;
  onClose: () => void;
}

export function MusicTogether({
  userId,
  privateKey,
  contact,
  isInitiator,
  incomingSignal,
  onClose,
}: MusicTogetherProps) {
  const [audioSource, setAudioSource] = useState<string>("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showSetup, setShowSetup] = useState(true);
  const [urlInput, setUrlInput] = useState("");
  const [isYoutube, setIsYoutube] = useState(false);
  const [peerConnected, setPeerConnected] = useState(false);
  const [isMicOn, setIsMicOn] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const peerRef = useRef<Peer.Instance | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getYoutubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const sendSignal = useCallback(async (data: any) => {
    await supabase.from("calls").insert({
      caller_id: userId,
      receiver_id: contact.id,
      type: data.type,
      signal_data: JSON.stringify(data),
      call_mode: "music-together",
    });
  }, [userId, contact.id]);

  useEffect(() => {
    const peer = new Peer({
      initiator: isInitiator,
      trickle: false,
    });

    peer.on("signal", (data) => {
      sendSignal(data);
    });

    peer.on("connect", () => {
      setPeerConnected(true);
      toast.success("Connected with " + contact.username);
    });

    peer.on("data", (data) => {
      const signal = JSON.parse(data.toString());
      if (signal.type === "PLAY") {
        setIsPlaying(true);
        audioRef.current?.play();
      } else if (signal.type === "PAUSE") {
        setIsPlaying(false);
        audioRef.current?.pause();
      } else if (signal.type === "SEEK") {
        if (audioRef.current) audioRef.current.currentTime = signal.time;
      } else if (signal.type === "SOURCE_CHANGE") {
        setAudioSource(signal.source);
        setIsYoutube(signal.isYoutube);
        setShowSetup(false);
      }
    });

    peer.on("stream", (stream) => {
      const audio = new Audio();
      audio.srcObject = stream;
      audio.play();
    });

    if (incomingSignal) {
      peer.signal(incomingSignal);
    }

    const channel = supabase
      .channel(`music-sync-${userId}-${contact.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "calls", filter: `receiver_id=eq.${userId}` }, (payload) => {
        const signal = JSON.parse(payload.new.signal_data);
        if (payload.new.caller_id === contact.id && payload.new.call_mode === "music-together") {
            peer.signal(signal);
        }
      })
      .subscribe();

    peerRef.current = peer;

    return () => {
      peer.destroy();
      channel.unsubscribe();
      localStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [isInitiator, contact, userId, sendSignal, incomingSignal]);

  const syncAction = (action: any) => {
    if (peerRef.current && peerConnected) {
      peerRef.current.send(JSON.stringify(action));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setAudioSource(url);
      setIsYoutube(false);
      setShowSetup(false);
      syncAction({ type: "SOURCE_CHANGE", source: url, isYoutube: false });
    }
  };

  const handleUrlSubmit = () => {
    if (urlInput.trim()) {
      const ytId = getYoutubeId(urlInput.trim());
      let source = urlInput.trim();
      let isYt = false;
      if (ytId) {
        isYt = true;
        source = `https://www.youtube.com/embed/${ytId}?autoplay=1&enablejsapi=1`;
      }
      setAudioSource(source);
      setIsYoutube(isYt);
      setShowSetup(false);
      syncAction({ type: "SOURCE_CHANGE", source, isYoutube: isYt });
    }
  };

  const togglePlay = () => {
    if (audioRef.current && !isYoutube) {
      const newState = !isPlaying;
      if (newState) {
        audioRef.current.play();
        syncAction({ type: "PLAY" });
      } else {
        audioRef.current.pause();
        syncAction({ type: "PAUSE" });
      }
      setIsPlaying(newState);
    }
  };

  const handleSeek = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
      syncAction({ type: "SEEK", time: value[0] });
    }
  };

  const toggleMic = async () => {
    if (!isMicOn) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = stream;
        peerRef.current?.addStream(stream);
        setIsMicOn(true);
      } catch (err) {
        toast.error("Could not access microphone");
      }
    } else {
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      setIsMicOn(false);
    }
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 z-[150] bg-[#020202] flex flex-col">
      <div className="h-20 border-b border-white/5 flex items-center justify-between px-6 bg-[#050505]">
        <div className="flex items-center gap-4">
          <AvatarDisplay profile={contact} className="h-10 w-10" />
          <div>
            <p className="text-sm font-black uppercase italic">{contact.username}</p>
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-indigo-400">
                {peerConnected ? "Synchronized" : "Establishing Link..."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
            <Button
                variant="ghost"
                size="icon"
                onClick={toggleMic}
                className={`w-12 h-12 rounded-2xl border border-white/10 ${isMicOn ? 'bg-indigo-500 text-white' : 'bg-white/5 text-white/40 hover:text-white'}`}
            >
                {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </Button>
            <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-all"
            >
                <X className="w-5 h-5" />
            </Button>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden flex flex-col items-center justify-center p-6">
        {/* Visualizer Background */}
        <div className="absolute inset-0 pointer-events-none">
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/5 blur-[150px] rounded-full transition-all duration-1000 ${isPlaying ? 'scale-110 opacity-20' : 'scale-90 opacity-10'}`} />
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/5 blur-[120px] rounded-full transition-all duration-1000 delay-300 ${isPlaying ? 'scale-125 opacity-15' : 'scale-95 opacity-5'}`} />
        </div>

        <AnimatePresence mode="wait">
          {showSetup ? (
            <motion.div
              key="setup"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md space-y-10 z-10"
            >
                <div className="text-center space-y-4">
                    <div className="w-24 h-24 mx-auto bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[2rem] flex items-center justify-center mb-8 shadow-2xl relative group">
                        <MusicIcon className="w-12 h-12 text-white" />
                    </div>
                    <h2 className="text-4xl font-black uppercase italic tracking-tighter">Music <span className="text-indigo-500">Together</span></h2>
                    <p className="text-xs font-bold uppercase tracking-[0.3em] text-white/30">Shared Neural Uplink</p>
                </div>

                <div className="space-y-6">
                    <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="audio/*" className="hidden" />
                    <Button onClick={() => fileInputRef.current?.click()} className="w-full h-20 bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] rounded-[1.5rem] text-white font-black uppercase tracking-[0.2em] text-[10px]">
                        <Upload className="w-5 h-5 mr-4 text-indigo-400" />
                        Share Local Audio
                    </Button>
                    <div className="relative flex items-center gap-4">
                        <div className="flex-1 h-px bg-white/5" />
                        <span className="text-[9px] font-black uppercase tracking-[0.5em] text-white/10">or</span>
                        <div className="flex-1 h-px bg-white/5" />
                    </div>
                    <div className="space-y-4">
                        <div className="relative">
                            <Link className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                            <Input
                                value={urlInput}
                                onChange={(e) => setUrlInput(e.target.value)}
                                placeholder="Paste YouTube link..."
                                className="h-16 bg-white/[0.03] border-white/10 rounded-2xl pl-12 text-white placeholder:text-white/20 text-xs"
                                onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
                            />
                        </div>
                        <Button onClick={handleUrlSubmit} disabled={!urlInput.trim()} className="w-full h-14 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px]">
                            Broadcast Stream
                        </Button>
                    </div>
                </div>
            </motion.div>
          ) : (
            <motion.div
                key="player"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full max-w-lg z-10 space-y-12 flex flex-col items-center"
            >
                {isYoutube ? (
                    <div className="aspect-video w-full rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl bg-black">
                        <iframe src={audioSource} className="w-full h-full" allow="autoplay; encrypted-media" />
                    </div>
                ) : (
                    <>
                        <div className="relative">
                            <motion.div 
                                animate={{ rotate: isPlaying ? 360 : 0 }}
                                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                                className="w-72 h-72 rounded-full bg-[#111] border-[14px] border-zinc-900 shadow-2xl relative flex items-center justify-center overflow-hidden"
                            >
                                <div className="absolute inset-0 opacity-20 bg-[repeating-radial-gradient(circle_at_center,#000,#000_2px,#111_2px,#111_4px)]" />
                                <div className="w-28 h-28 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center border-4 border-zinc-900 z-10 shadow-xl overflow-hidden">
                                    <AvatarDisplay profile={contact} className="w-full h-full scale-110" />
                                </div>
                            </motion.div>
                            <div className="absolute -bottom-2 -right-2 w-14 h-14 bg-indigo-600 rounded-full flex items-center justify-center border-4 border-[#020202] shadow-lg">
                                <MusicIcon className="w-6 h-6 text-white" />
                            </div>
                        </div>

                        <div className="w-full space-y-8">
                            <div className="space-y-3">
                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-white/30 px-1">
                                    <span>{formatTime(currentTime)}</span>
                                    <span>{formatTime(duration)}</span>
                                </div>
                                <Slider value={[currentTime]} max={duration || 100} step={0.1} onValueChange={handleSeek} className="cursor-pointer" />
                            </div>

                            <div className="flex items-center justify-center gap-10">
                                <Button variant="ghost" size="icon" onClick={() => { if(audioRef.current) handleSeek([audioRef.current.currentTime - 10]) }} className="text-white/40 hover:text-white">
                                    <SkipBack className="w-7 h-7 fill-current" />
                                </Button>
                                <Button onClick={togglePlay} className="w-24 h-24 rounded-full bg-white text-black hover:scale-105 transition-all shadow-xl flex items-center justify-center">
                                    {isPlaying ? <Pause className="w-10 h-10 fill-current" /> : <Play className="w-10 h-10 fill-current ml-1" />}
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => { if(audioRef.current) handleSeek([audioRef.current.currentTime + 10]) }} className="text-white/40 hover:text-white">
                                    <SkipForward className="w-7 h-7 fill-current" />
                                </Button>
                            </div>

                            <div className="flex items-center gap-4 justify-center pt-4">
                                <Button variant="ghost" size="icon" onClick={() => setIsMuted(!isMuted)} className="text-white/40 hover:text-white">
                                    {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                                </Button>
                                <div className="w-32">
                                    <Slider value={[isMuted ? 0 : volume]} max={1} step={0.01} onValueChange={(v) => setVolume(v[0])} />
                                </div>
                            </div>
                        </div>
                    </>
                )}
                
                <audio
                    ref={audioRef}
                    src={audioSource}
                    muted={isMuted}
                    onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
                    onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
                    onEnded={() => setIsPlaying(false)}
                />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="p-6 bg-[#050505] border-t border-white/5 flex items-center gap-4">
          <Input placeholder="Sync a message..." className="bg-white/[0.03] border-white/10 rounded-xl" />
          <Button size="icon" className="bg-indigo-600 rounded-xl"><MessageCircle className="w-5 h-5" /></Button>
      </div>
    </div>
  );
}
