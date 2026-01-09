"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import {
  Music,
  Play,
  Pause,
  Volume2,
  VolumeX,
  X,
  SkipBack,
  SkipForward,
  Users,
  MessageCircle,
  Send,
  ChevronUp,
  ChevronDown,
  Upload,
  Link as LinkIcon,
  ShieldCheck,
  Disc,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { encryptMessage, decryptMessage, importPublicKey } from "@/lib/crypto";

interface MusicTogetherProps {
  contact: any;
  onClose: () => void;
  userId: string;
  privateKey: CryptoKey;
  isInitiator?: boolean;
  incomingSignal?: any;
}

export function MusicTogether({ contact, onClose, userId, privateKey, isInitiator = true, incomingSignal }: MusicTogetherProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState("Initializing...");
  const [showSetup, setShowSetup] = useState(true);
  const [audioUrl, setAudioUrl] = useState("");
  const [localAudioFile, setLocalAudioFile] = useState<File | null>(null);
  const [localAudioUrl, setLocalAudioUrl] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<{id: string; text: string; sender: string; time: Date}[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [receivingAudio, setReceivingAudio] = useState(false);
  const [audioReceiveProgress, setAudioReceiveProgress] = useState(0);
  const [sendingAudio, setSendingAudio] = useState(false);
  const [audioSendProgress, setAudioSendProgress] = useState(0);
  const [isVisualizerExpanded, setIsVisualizerExpanded] = useState(true);

  const myAudio = useRef<HTMLAudioElement>(null);
  const remoteAudio = useRef<HTMLAudioElement>(null);
  const mainAudioRef = useRef<HTMLAudioElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<any>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const hasAnswered = useRef(false);
  const iceCandidateQueue = useRef<RTCIceCandidateInit[]>([]);
  const remoteDescriptionSet = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const audioChunksRef = useRef<ArrayBuffer[]>([]);
  const expectedChunksRef = useRef<number>(0);
  const receivedChunksCountRef = useRef<number>(0);
  const partnerPublicKeyRef = useRef<CryptoKey | null>(null);

  const encryptSignal = async (data: any) => {
    if (!partnerPublicKeyRef.current) {
      if (contact.public_key) {
        partnerPublicKeyRef.current = await importPublicKey(contact.public_key);
      } else {
        return JSON.stringify(data);
      }
    }
    try {
      const encrypted = await encryptMessage(JSON.stringify(data), partnerPublicKeyRef.current);
      return JSON.stringify({ encrypted });
    } catch (e) {
      console.error("Encryption failed", e);
      return JSON.stringify(data);
    }
  };

  const decryptSignal = async (signalStr: string) => {
    try {
      const parsed = JSON.parse(signalStr);
      if (parsed.encrypted) {
        const decrypted = await decryptMessage(parsed.encrypted, privateKey);
        return JSON.parse(decrypted);
      }
      return parsed;
    } catch (e) {
      console.error("Decryption failed", e);
      return JSON.parse(signalStr);
    }
  };

  const processQueuedCandidates = async (pc: RTCPeerConnection) => {
    while (iceCandidateQueue.current.length > 0) {
      const candidate = iceCandidateQueue.current.shift();
      if (candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error("Failed to add queued ICE candidate:", err);
        }
      }
    }
  };

  const sendSyncMessage = useCallback((action: string, data: any) => {
    if (dataChannelRef.current && dataChannelRef.current.readyState === "open") {
      dataChannelRef.current.send(JSON.stringify({ action, ...data }));
    }
  }, []);

  const sendAudioFile = useCallback(async (file: File) => {
    if (!dataChannelRef.current || dataChannelRef.current.readyState !== "open") {
      toast.error("Connection not ready. Please wait.");
      return;
    }
    
    setSendingAudio(true);
    setAudioSendProgress(0);
    
    const CHUNK_SIZE = 16384;
    const arrayBuffer = await file.arrayBuffer();
    const totalChunks = Math.ceil(arrayBuffer.byteLength / CHUNK_SIZE);
    
    sendSyncMessage("audioStart", { 
      totalSize: arrayBuffer.byteLength, 
      totalChunks, 
      fileName: file.name,
      fileType: file.type 
    });
    
    try {
      for (let i = 0; i < totalChunks; i++) {
        if (!dataChannelRef.current || dataChannelRef.current.readyState !== "open") {
          throw new Error("Connection closed");
        }
        
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, arrayBuffer.byteLength);
        const chunk = arrayBuffer.slice(start, end);
        
        while (dataChannelRef.current.bufferedAmount > 1024 * 1024) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        dataChannelRef.current.send(chunk);
        setAudioSendProgress(Math.round(((i + 1) / totalChunks) * 100));
      }
      
      sendSyncMessage("audioEnd", {});
      toast.success("Music shared with partner!");
    } catch (err) {
      console.error("Audio transfer failed:", err);
      toast.error("Transfer interrupted");
    } finally {
      setSendingAudio(false);
    }
  }, [sendSyncMessage]);

  const handleDataChannelMessage = useCallback((event: MessageEvent) => {
    if (event.data instanceof ArrayBuffer) {
      audioChunksRef.current.push(event.data);
      receivedChunksCountRef.current++;
      const progress = Math.round((receivedChunksCountRef.current / expectedChunksRef.current) * 100);
      setAudioReceiveProgress(progress);
      return;
    }
    
    try {
      const data = JSON.parse(event.data);
      if (data.action === "audioStart") {
        setReceivingAudio(true);
        expectedChunksRef.current = data.totalChunks;
        audioChunksRef.current = [];
        receivedChunksCountRef.current = 0;
        setAudioReceiveProgress(0);
        toast.info(`Receiving music: ${data.fileName}`);
      } else if (data.action === "audioEnd") {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/mpeg' });
        const url = URL.createObjectURL(blob);
        setLocalAudioUrl(url);
        setShowSetup(false);
        setReceivingAudio(false);
        audioChunksRef.current = [];
        toast.success("Music received! Ready to play.");
      } else if (data.action === "play" && mainAudioRef.current) {
        mainAudioRef.current.currentTime = data.time;
        mainAudioRef.current.play().catch(e => console.error("Auto-play failed:", e));
        setIsPlaying(true);
      } else if (data.action === "pause" && mainAudioRef.current) {
        mainAudioRef.current.currentTime = data.time;
        mainAudioRef.current.pause();
        setIsPlaying(false);
      } else if (data.action === "seek" && mainAudioRef.current) {
        mainAudioRef.current.currentTime = data.time;
      } else if (data.action === "url" && data.url) {
        setAudioUrl(data.url);
        setShowSetup(false);
      } else if (data.action === "chat" && data.message) {
        setChatMessages(prev => [...prev, {
          id: Date.now().toString(),
          text: data.message,
          sender: contact.username,
          time: new Date()
        }]);
      }
    } catch (e) {
      console.error("Failed to parse message:", e);
    }
  }, [contact.username]);

  const createPeerConnection = useCallback(
    (localStream: MediaStream) => {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
        ],
      });

      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });

      if (isInitiator) {
        const dataChannel = pc.createDataChannel("musicTogetherSync");
        dataChannel.onmessage = handleDataChannelMessage;
        dataChannelRef.current = dataChannel;
      }

      pc.ondatachannel = (event) => {
        const channel = event.channel;
        channel.onmessage = handleDataChannelMessage;
        dataChannelRef.current = channel;
      };

      pc.ontrack = (event) => {
        const [remoteStreamFromEvent] = event.streams;
        if (remoteStreamFromEvent) {
          setRemoteStream(remoteStreamFromEvent);
          setIsConnecting(false);
          setConnectionStatus("Connected");
        }
      };

      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          const encryptedData = await encryptSignal({ candidate: event.candidate.toJSON() });
          await supabase.from("calls").insert({
            caller_id: userId,
            receiver_id: contact.id,
            signal_data: encryptedData,
            type: "candidate",
            call_mode: "music",
          });
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === "connected") {
          setIsConnecting(false);
          setConnectionStatus("Connected");
        } else if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "closed") {
          endCall();
        }
      };

      return pc;
    },
    [userId, contact.id, handleDataChannelMessage, isInitiator]
  );

  useEffect(() => {
    let isMounted = true;

    const startCall = async () => {
      try {
        if (contact.public_key) {
          partnerPublicKeyRef.current = await importPublicKey(contact.public_key);
        }

        const localStream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: true,
        });
        if (!isMounted) {
          localStream.getTracks().forEach((t) => t.stop());
          return;
        }

        setStream(localStream);

        const pc = createPeerConnection(localStream);
        peerConnection.current = pc;

        if (isInitiator) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          const encryptedData = await encryptSignal({ sdp: pc.localDescription });
          await supabase.from("calls").insert({
            caller_id: userId,
            receiver_id: contact.id,
            signal_data: encryptedData,
            type: "offer",
            call_mode: "music",
          });
        } else if (incomingSignal) {
          const signal = await decryptSignal(JSON.stringify(incomingSignal));
          if (signal.sdp) {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
            remoteDescriptionSet.current = true;
            await processQueuedCandidates(pc);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            const encryptedData = await encryptSignal({ sdp: pc.localDescription });
            await supabase.from("calls").insert({
              caller_id: userId,
              receiver_id: contact.id,
              signal_data: encryptedData,
              type: "answer",
              call_mode: "music",
            });
          }
        }

        const channelId = [userId, contact.id].sort().join("-");
        const channel = supabase
          .channel(`music-together-${channelId}`)
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "calls", filter: `receiver_id=eq.${userId}` }, async (payload) => {
            const data = payload.new;
            if (!peerConnection.current) return;
            const signalData = await decryptSignal(data.signal_data);

            if (data.type === "answer" && isInitiator && signalData.sdp && !hasAnswered.current) {
              hasAnswered.current = true;
              await peerConnection.current.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
              remoteDescriptionSet.current = true;
              await processQueuedCandidates(peerConnection.current);
            } else if (data.type === "candidate" && signalData.candidate) {
              if (remoteDescriptionSet.current) {
                await peerConnection.current.addIceCandidate(new RTCIceCandidate(signalData.candidate));
              } else {
                iceCandidateQueue.current.push(signalData.candidate);
              }
            } else if (data.type === "end") {
              endCall();
            }
          })
          .subscribe();
        channelRef.current = channel;
      } catch (err) {
        console.error("Music Together setup failed:", err);
        toast.error("Connection failed.");
        onClose();
      }
    };

    startCall();
    return () => {
      isMounted = false;
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (peerConnection.current) peerConnection.current.close();
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, []);

  const endCall = async () => {
    try {
      await supabase.from("calls").insert({ caller_id: userId, receiver_id: contact.id, type: "end", signal_data: "{}" });
    } catch (e) {}
    if (stream) stream.getTracks().forEach((t) => t.stop());
    if (peerConnection.current) peerConnection.current.close();
    if (localAudioUrl) URL.revokeObjectURL(localAudioUrl);
    onClose();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLocalAudioFile(file);
      const url = URL.createObjectURL(file);
      setLocalAudioUrl(url);
      setShowSetup(false);
      sendAudioFile(file);
    }
  };

  const handleUrlSubmit = () => {
    if (audioUrl.trim()) {
      sendSyncMessage("url", { url: audioUrl });
      setShowSetup(false);
    }
  };

  const handlePlayPause = () => {
    if (mainAudioRef.current) {
      if (isPlaying) {
        mainAudioRef.current.pause();
        sendSyncMessage("pause", { time: mainAudioRef.current.currentTime });
        setIsPlaying(false);
      } else {
        mainAudioRef.current.play().catch(e => console.error("Play failed:", e));
        sendSyncMessage("play", { time: mainAudioRef.current.currentTime });
        setIsPlaying(true);
      }
    }
  };

  const handleSeek = (value: number[]) => {
    if (mainAudioRef.current) {
      mainAudioRef.current.currentTime = value[0];
      sendSyncMessage("seek", { time: value[0] });
    }
  };

  const handleVolumeChange = (value: number[]) => {
    if (mainAudioRef.current) {
      mainAudioRef.current.volume = value[0];
      setVolume(value[0]);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const sendChatMessage = () => {
    if (chatInput.trim()) {
      const newMessage = {
        id: Date.now().toString(),
        text: chatInput.trim(),
        sender: "me",
        time: new Date()
      };
      setChatMessages(prev => [...prev, newMessage]);
      sendSyncMessage("chat", { message: chatInput.trim() });
      setChatInput("");
    }
  };

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  return (
    <div className="fixed inset-0 z-[100] bg-[#050505] flex flex-col">
      <audio ref={remoteAudio} autoPlay playsInline />
      
      <AnimatePresence mode="wait">
        {showSetup ? (
          <motion.div
            key="setup"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="flex-1 flex flex-col items-center justify-center p-6 bg-gradient-to-br from-zinc-950 via-[#050505] to-zinc-950"
          >
            <div className="w-full max-w-lg space-y-10">
              <div className="text-center space-y-4">
                <div className="w-24 h-24 mx-auto bg-gradient-to-br from-indigo-500 via-blue-500 to-purple-600 rounded-[2.5rem] flex items-center justify-center shadow-2xl relative group">
                  <div className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-full" />
                  <Music className="w-10 h-10 text-white relative" />
                </div>
                <h2 className="text-4xl font-black uppercase italic tracking-tighter">Music <span className="text-indigo-500">Together</span></h2>
                <div className="flex items-center justify-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <p className="text-emerald-400 font-black uppercase tracking-widest text-[10px]">P2P Synchronized</p>
                </div>
              </div>

              <div className="bg-white/[0.02] border border-white/10 rounded-[2.5rem] p-6 flex items-center gap-5">
                <Avatar className="h-14 w-14 border-2 border-indigo-500/50">
                  <AvatarImage src={contact.avatar_url} />
                  <AvatarFallback className="bg-indigo-900 font-black">
                    {contact.username?.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-black uppercase text-sm">{contact.username}</p>
                  <p className={`text-[10px] font-black uppercase tracking-widest ${isConnecting ? "text-amber-400 animate-pulse" : "text-emerald-400"}`}>
                    {connectionStatus}
                  </p>
                </div>
                <Users className="w-6 h-6 text-white/20" />
              </div>

              {receivingAudio ? (
                <div className="space-y-4 text-center">
                    <Disc className="w-12 h-12 text-indigo-400 mx-auto animate-spin" />
                    <p className="text-sm font-black uppercase tracking-widest text-white/40">Receiving Signal: {audioReceiveProgress}%</p>
                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                        <motion.div className="h-full bg-indigo-500" initial={{ width: 0 }} animate={{ width: `${audioReceiveProgress}%` }} />
                    </div>
                </div>
              ) : sendingAudio ? (
                <div className="space-y-4 text-center">
                    <Upload className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
                    <p className="text-sm font-black uppercase tracking-widest text-white/40">Broadcasting: {audioSendProgress}%</p>
                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                        <motion.div className="h-full bg-emerald-500" initial={{ width: 0 }} animate={{ width: `${audioSendProgress}%` }} />
                    </div>
                </div>
              ) : isInitiator ? (
                <div className="space-y-6">
                  <input type="file" ref={fileInputRef} accept="audio/*" onChange={handleFileSelect} className="hidden" />
                  <Button onClick={() => fileInputRef.current?.click()} disabled={isConnecting}
                    className="w-full h-20 bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] hover:border-indigo-500/50 rounded-[2rem] text-white font-black uppercase tracking-widest transition-all group"
                  >
                    <Upload className="w-5 h-5 mr-3 text-indigo-400 group-hover:scale-110 transition-transform" />
                    Share Local Audio
                  </Button>
                  <div className="relative py-2 flex items-center gap-4">
                    <div className="flex-1 h-px bg-white/5" />
                    <span className="text-[10px] font-black uppercase tracking-[0.5em] text-white/10">OR</span>
                    <div className="flex-1 h-px bg-white/5" />
                  </div>
                  <div className="flex gap-3">
                    <Input placeholder="PASTE STREAM URL..." value={audioUrl} onChange={(e) => setAudioUrl(e.target.value)}
                        className="h-16 bg-white/[0.03] border-white/10 rounded-[1.5rem] pl-6 text-sm font-bold tracking-wider focus:border-indigo-500/50"
                    />
                    <Button onClick={handleUrlSubmit} disabled={!audioUrl.trim() || isConnecting}
                        className="h-16 px-8 bg-indigo-600 hover:bg-indigo-700 rounded-[1.5rem] font-black uppercase tracking-widest"
                    >
                        Load
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 space-y-4">
                    <Disc className="w-16 h-16 text-white/5 mx-auto animate-spin-slow" />
                    <p className="text-sm font-black uppercase tracking-[0.3em] text-white/20">Waiting for Broadcast...</p>
                </div>
              )}

              <Button onClick={endCall} variant="ghost" className="w-full h-14 text-red-500/50 hover:text-red-500 hover:bg-red-500/10 rounded-[1.5rem] font-black uppercase tracking-[0.2em] transition-all">
                Terminate Link
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="player" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col relative overflow-hidden">
            {/* Background Visualizer */}
            <div className="absolute inset-0 pointer-events-none">
                <motion.div animate={{ scale: isPlaying ? [1, 1.15, 1] : 1, opacity: isPlaying ? [0.05, 0.1, 0.05] : 0.05 }} transition={{ duration: 3, repeat: Infinity }} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/20 blur-[150px] rounded-full" />
            </div>

            <header className="p-6 flex items-center justify-between z-10">
                <Button variant="ghost" size="icon" onClick={endCall} className="w-12 h-12 rounded-2xl bg-white/5 hover:bg-white/10">
                    <X className="w-5 h-5 text-white/40 hover:text-white" />
                </Button>
                <div className="flex items-center gap-3 px-4 py-2 bg-white/5 rounded-2xl border border-white/10">
                    <Disc className={`w-4 h-4 text-indigo-400 ${isPlaying ? 'animate-spin' : ''}`} />
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/60">Live Sessions</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowChat(!showChat)} className={`w-12 h-12 rounded-2xl ${showChat ? 'bg-indigo-500 text-white' : 'bg-white/5 text-white/40'}`}>
                    <MessageCircle className="w-5 h-5" />
                </Button>
            </header>

            <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-12 z-10">
                <div className="relative group">
                    <motion.div animate={{ rotate: isPlaying ? 360 : 0 }} transition={{ duration: 15, repeat: Infinity, ease: "linear" }} className="w-64 h-64 sm:w-80 sm:h-80 rounded-full border-8 border-white/5 p-2 shadow-2xl relative">
                        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-500/20 via-transparent to-purple-500/20 animate-pulse" />
                        <div className="w-full h-full rounded-full bg-zinc-900 flex items-center justify-center relative overflow-hidden">
                            <Disc className={`w-32 h-32 text-indigo-500/20 ${isPlaying ? 'animate-spin-slow' : ''}`} />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Avatar className="h-32 w-32 border-4 border-[#050505] shadow-2xl">
                                    <AvatarImage src={contact.avatar_url} />
                                    <AvatarFallback className="bg-indigo-950 text-white font-black text-2xl">{contact.username?.substring(0,2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                            </div>
                        </div>
                    </motion.div>
                    
                    <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex -space-x-3">
                        <Avatar className="h-10 w-10 border-4 border-[#050505]">
                            <AvatarImage src={contact.avatar_url} />
                            <AvatarFallback>C</AvatarFallback>
                        </Avatar>
                        <div className="w-10 h-10 rounded-full border-4 border-[#050505] bg-indigo-500 flex items-center justify-center">
                            <Users className="w-4 h-4 text-white" />
                        </div>
                    </div>
                </div>

                <div className="text-center space-y-2 max-w-md w-full">
                    <h3 className="text-2xl font-black uppercase italic tracking-tight truncate">{localAudioFile?.name || "Streaming Signal"}</h3>
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20">Synchronized Uplink Active</p>
                </div>

                <div className="w-full max-w-lg space-y-8">
                    <div className="space-y-4">
                        <Slider value={[currentTime]} max={duration || 100} step={0.1} onValueChange={handleSeek} />
                        <div className="flex justify-between font-mono text-[10px] font-black text-white/30 tracking-widest">
                            <span>{formatTime(currentTime)}</span>
                            <span>{formatTime(duration)}</span>
                        </div>
                    </div>

                    <div className="flex items-center justify-center gap-12">
                        <Button variant="ghost" size="icon" onClick={() => skip(-10)} className="w-12 h-12 rounded-full text-white/20 hover:text-white hover:bg-white/5">
                            <SkipBack className="w-8 h-8 fill-current" />
                        </Button>
                        
                        <motion.button whileTap={{ scale: 0.9 }} onClick={handlePlayPause} className="w-24 h-24 rounded-full bg-white text-[#050505] flex items-center justify-center shadow-2xl shadow-white/10">
                            {isPlaying ? <Pause className="w-10 h-10 fill-current" /> : <Play className="w-10 h-10 fill-current ml-2" />}
                        </motion.button>

                        <Button variant="ghost" size="icon" onClick={() => skip(10)} className="w-12 h-12 rounded-full text-white/20 hover:text-white hover:bg-white/5">
                            <SkipForward className="w-8 h-8 fill-current" />
                        </Button>
                    </div>

                    <div className="flex items-center justify-center gap-6 pt-4">
                        <div className="flex items-center gap-4 w-48">
                            <Button variant="ghost" size="icon" className="text-white/30" onClick={() => setVolume(v => v === 0 ? 0.8 : 0)}>
                                {volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                            </Button>
                            <Slider value={[volume]} max={1} step={0.01} onValueChange={handleVolumeChange} />
                        </div>
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {showChat && (
                    <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} className="absolute inset-y-0 right-0 w-full sm:w-96 bg-[#050505]/95 backdrop-blur-3xl border-l border-white/5 z-20 flex flex-col">
                        <div className="p-6 border-b border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <MessageCircle className="w-5 h-5 text-indigo-400" />
                                <h3 className="text-sm font-black uppercase tracking-widest">Vibe Chat</h3>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setShowChat(false)} className="text-white/20 hover:text-white"><ChevronDown className="w-5 h-5" /></Button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                            {chatMessages.map(msg => (
                                <div key={msg.id} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] p-4 rounded-2xl ${msg.sender === 'me' ? 'bg-indigo-600' : 'bg-white/5 border border-white/10'}`}>
                                        {msg.sender !== 'me' && <p className="text-[10px] font-black text-indigo-400 uppercase mb-1">{msg.sender}</p>}
                                        <p className="text-xs font-medium leading-relaxed">{msg.text}</p>
                                    </div>
                                </div>
                            ))}
                            <div ref={chatEndRef} />
                        </div>

                        <div className="p-6 border-t border-white/5 bg-[#050505]">
                            <div className="flex gap-3">
                                <Input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChatMessage()} placeholder="Broadcast message..." className="h-14 bg-white/5 border-white/10 rounded-2xl text-xs" />
                                <Button onClick={sendChatMessage} disabled={!chatInput.trim()} size="icon" className="h-14 w-14 bg-indigo-600 hover:bg-indigo-700 rounded-2xl"><Send className="w-5 h-5" /></Button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <audio ref={mainAudioRef} src={localAudioUrl || audioUrl} onTimeUpdate={handleTimeUpdate} onLoadedMetadata={handleLoadedMetadata} onEnded={() => setIsPlaying(false)} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
