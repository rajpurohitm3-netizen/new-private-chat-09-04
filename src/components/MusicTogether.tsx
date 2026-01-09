"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import {
  Music,
  Phone,
  MicOff,
  Mic,
  PhoneOff,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Upload,
  Link as LinkIcon,
  X,
  Disc,
  Heart,
  MessageCircle,
  Send,
  Users,
  ShieldCheck,
  ChevronUp,
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
  const [callDuration, setCallDuration] = useState(0);
  const [showSetup, setShowSetup] = useState(true);
  const [musicUrl, setMusicUrl] = useState("");
  const [localMusicFile, setLocalMusicFile] = useState<File | null>(null);
  const [localMusicUrl, setLocalMusicUrl] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<{id: string; text: string; sender: string; time: Date}[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [receivingMusic, setReceivingMusic] = useState(false);
  const [musicReceiveProgress, setMusicReceiveProgress] = useState(0);
  const [sendingMusic, setSendingMusic] = useState(false);
  const [musicSendProgress, setMusicSendProgress] = useState(0);
  const [isLiked, setIsLiked] = useState(false);

  const myAudio = useRef<HTMLAudioElement>(null);
  const userAudio = useRef<HTMLAudioElement>(null);
  const musicAudio = useRef<HTMLAudioElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<any>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const hasAnswered = useRef(false);
  const iceCandidateQueue = useRef<RTCIceCandidateInit[]>([]);
  const remoteDescriptionSet = useRef(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const musicChunksRef = useRef<ArrayBuffer[]>([]);
  const expectedChunksRef = useRef<number>(0);
  const receivedChunksCountRef = useRef<number>(0);
  const partnerPublicKeyRef = useRef<CryptoKey | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!isConnecting) {
        setCallDuration((prev) => prev + 1);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [isConnecting]);

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
      return JSON.parse(signalStr);
    }
  };

  const processQueuedCandidates = async (pc: RTCPeerConnection) => {
    while (iceCandidateQueue.current.length > 0) {
      const candidate = iceCandidateQueue.current.shift();
      if (candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {}
      }
    }
  };

  const sendSyncMessage = useCallback((action: string, data: any) => {
    if (dataChannelRef.current && dataChannelRef.current.readyState === "open") {
      dataChannelRef.current.send(JSON.stringify({ action, ...data }));
    }
  }, []);

  const sendMusicFile = useCallback(async (file: File) => {
    if (!dataChannelRef.current || dataChannelRef.current.readyState !== "open") {
      toast.error("Connection not ready");
      return;
    }
    
    setSendingMusic(true);
    setMusicSendProgress(0);
    
    const CHUNK_SIZE = 16384;
    const arrayBuffer = await file.arrayBuffer();
    const totalChunks = Math.ceil(arrayBuffer.byteLength / CHUNK_SIZE);
    
    sendSyncMessage("musicStart", { 
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
        setMusicSendProgress(Math.round(((i + 1) / totalChunks) * 100));
      }
      sendSyncMessage("musicEnd", {});
      toast.success("Music shared!");
    } catch (err) {
      toast.error("Sharing interrupted");
    } finally {
      setSendingMusic(false);
    }
  }, [sendSyncMessage]);

  const handleDataChannelMessage = useCallback((event: MessageEvent) => {
    if (event.data instanceof ArrayBuffer) {
      musicChunksRef.current.push(event.data);
      receivedChunksCountRef.current++;
      setMusicReceiveProgress(Math.round((receivedChunksCountRef.current / expectedChunksRef.current) * 100));
      return;
    }
    
    try {
      const data = JSON.parse(event.data);
      if (data.action === "musicStart") {
        setReceivingMusic(true);
        expectedChunksRef.current = data.totalChunks;
        musicChunksRef.current = [];
        receivedChunksCountRef.current = 0;
        setMusicReceiveProgress(0);
      } else if (data.action === "musicEnd") {
        const blob = new Blob(musicChunksRef.current, { type: 'audio/mpeg' });
        const url = URL.createObjectURL(blob);
        setLocalMusicUrl(url);
        setShowSetup(false);
        setReceivingMusic(false);
        musicChunksRef.current = [];
        toast.success("Music received!");
      } else if (data.action === "play" && musicAudio.current) {
        musicAudio.current.currentTime = data.time;
        musicAudio.current.play().catch(() => {});
        setIsPlaying(true);
      } else if (data.action === "pause" && musicAudio.current) {
        musicAudio.current.currentTime = data.time;
        musicAudio.current.pause();
        setIsPlaying(false);
      } else if (data.action === "seek" && musicAudio.current) {
        musicAudio.current.currentTime = data.time;
      } else if (data.action === "url" && data.url) {
        setMusicUrl(data.url);
        setShowSetup(false);
      } else if (data.action === "chat" && data.message) {
        setChatMessages(prev => [...prev, {
          id: Date.now().toString(),
          text: data.message,
          sender: contact.username,
          time: new Date()
        }]);
      }
    } catch (e) {}
  }, [contact.username]);

  const createPeerConnection = useCallback(
    (localStream: MediaStream) => {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
        ],
      });

      localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

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
        const localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
          .channel(`music-${channelId}`)
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
        toast.error("Connection failed");
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
    if (localMusicUrl) URL.revokeObjectURL(localMusicUrl);
    onClose();
  };

  const toggleMute = () => {
    if (stream) {
      stream.getAudioTracks()[0].enabled = !stream.getAudioTracks()[0].enabled;
      setIsMuted(!stream.getAudioTracks()[0].enabled);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLocalMusicFile(file);
      const url = URL.createObjectURL(file);
      setLocalMusicUrl(url);
      setShowSetup(false);
      sendMusicFile(file);
    }
  };

  const handleUrlSubmit = () => {
    if (musicUrl.trim()) {
      sendSyncMessage("url", { url: musicUrl });
      setShowSetup(false);
    }
  };

  const handlePlayPause = () => {
    if (musicAudio.current) {
      if (isPlaying) {
        musicAudio.current.pause();
        sendSyncMessage("pause", { time: musicAudio.current.currentTime });
        setIsPlaying(false);
      } else {
        musicAudio.current.play().catch(() => {});
        sendSyncMessage("play", { time: musicAudio.current.currentTime });
        setIsPlaying(true);
      }
    }
  };

  const handleSeek = (value: number[]) => {
    if (musicAudio.current) {
      musicAudio.current.currentTime = value[0];
      sendSyncMessage("seek", { time: value[0] });
    }
  };

  const handleVolumeChange = (value: number[]) => {
    if (musicAudio.current) {
      musicAudio.current.volume = value[0];
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
      const newMessage = { id: Date.now().toString(), text: chatInput.trim(), sender: "me", time: new Date() };
      setChatMessages(prev => [...prev, newMessage]);
      sendSyncMessage("chat", { message: chatInput.trim() });
      setChatInput("");
    }
  };

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  return (
    <div className="fixed inset-0 z-[100] bg-[#030303] flex flex-col overflow-hidden">
      <audio ref={userAudio} autoPlay playsInline />
      <audio 
        ref={musicAudio} 
        src={localMusicUrl || musicUrl} 
        onTimeUpdate={() => musicAudio.current && setCurrentTime(musicAudio.current.currentTime)}
        onLoadedMetadata={() => musicAudio.current && setDuration(musicAudio.current.duration)}
        onEnded={() => setIsPlaying(false)}
      />

      <div className="flex-1 flex flex-col relative p-6 sm:p-12">
        <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] bg-pink-600/10 blur-[200px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[80%] h-[80%] bg-rose-600/10 blur-[200px] rounded-full pointer-events-none" />

        <div className="flex items-center justify-between mb-8 relative z-10">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={endCall} className="text-white/40 hover:text-white bg-white/5 rounded-2xl"><X className="w-5 h-5" /></Button>
            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full">
              <div className="w-2 h-2 bg-pink-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest text-white/50">{connectionStatus}</span>
            </div>
          </div>
          <div className="flex -space-x-3">
             <Avatar className="h-10 w-10 border-2 border-[#030303]"><AvatarImage src={contact.avatar_url} /><AvatarFallback>{contact.username[0]}</AvatarFallback></Avatar>
             <div className="h-10 w-10 rounded-full border-2 border-[#030303] bg-pink-600 flex items-center justify-center text-[10px] font-black">YOU</div>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center relative z-10">
          <AnimatePresence mode="wait">
            {showSetup ? (
              <motion.div key="setup" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="w-full max-w-md space-y-8 bg-white/[0.02] border border-white/10 p-10 rounded-[3rem] backdrop-blur-3xl">
                <div className="text-center space-y-4">
                  <div className="w-20 h-20 mx-auto bg-pink-600/20 rounded-3xl flex items-center justify-center"><Music className="w-10 h-10 text-pink-500" /></div>
                  <h2 className="text-2xl font-black uppercase italic">Music Together</h2>
                  <p className="text-xs text-white/30 uppercase tracking-widest leading-relaxed">
                    {isInitiator ? "Select music to sync with " + contact.username : "Waiting for partner to select music..."}
                  </p>
                </div>

                {receivingMusic ? (
                   <div className="space-y-4 pt-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-center text-pink-400">Receiving Encrypted Stream...</p>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden"><motion.div className="h-full bg-pink-600" animate={{ width: `${musicReceiveProgress}%` }} /></div>
                   </div>
                ) : sendingMusic ? (
                  <div className="space-y-4 pt-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-center text-emerald-400">Syncing with partner node...</p>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden"><motion.div className="h-full bg-emerald-500" animate={{ width: `${musicSendProgress}%` }} /></div>
                  </div>
                ) : isInitiator && (
                  <div className="space-y-4">
                    <Button onClick={() => document.getElementById('music-upload')?.click()} className="w-full h-14 bg-white/5 border border-white/10 hover:bg-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest"><Upload className="w-4 h-4 mr-2" /> Share Local File</Button>
                    <input id="music-upload" type="file" accept="audio/*" onChange={handleFileSelect} className="hidden" />
                    <div className="flex gap-2">
                      <Input placeholder="Paste Audio URL..." value={musicUrl} onChange={(e) => setMusicUrl(e.target.value)} className="h-14 bg-white/5 border-white/10 rounded-2xl" />
                      <Button onClick={handleUrlSubmit} className="h-14 px-6 bg-pink-600 rounded-2xl font-black uppercase text-[10px]">Play</Button>
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div key="player" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full flex flex-col items-center">
                 <motion.div animate={{ rotate: isPlaying ? 360 : 0 }} transition={{ duration: 12, repeat: Infinity, ease: "linear" }} className="relative mb-12">
                   <div className="w-64 h-64 sm:w-80 sm:h-80 rounded-full bg-gradient-to-br from-zinc-800 to-black p-1 shadow-[0_0_100px_rgba(219,39,119,0.2)] border-4 border-white/5 flex items-center justify-center">
                     <Disc className="w-full h-full text-white/5" />
                     <div className="absolute w-28 h-28 rounded-full border border-white/10 overflow-hidden shadow-2xl">
                        <Avatar className="h-full w-full"><AvatarImage src={contact.avatar_url} /><AvatarFallback>{contact.username[0]}</AvatarFallback></Avatar>
                     </div>
                   </div>
                 </motion.div>

                 <div className="text-center mb-12 space-y-2">
                   <h3 className="text-2xl font-black uppercase italic tracking-tighter">{localMusicFile?.name?.replace(/\.[^/.]+$/, "") || "Synced Stream"}</h3>
                   <div className="flex items-center justify-center gap-2"><ShieldCheck className="w-3 h-3 text-emerald-500" /><p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">Secure Encrypted Session</p></div>
                 </div>

                 <div className="w-full max-w-xl bg-white/[0.03] border border-white/10 p-8 rounded-[3rem] backdrop-blur-3xl space-y-8">
                   <div className="space-y-4">
                     <Slider value={[currentTime]} max={duration || 100} step={0.1} onValueChange={handleSeek} />
                     <div className="flex justify-between text-[10px] font-black text-white/30 uppercase tracking-widest">
                       <span>{formatTime(currentTime)}</span>
                       <span>{formatTime(duration)}</span>
                     </div>
                   </div>

                   <div className="flex items-center justify-between">
                     <Button variant="ghost" size="icon" onClick={() => setIsLiked(!isLiked)} className={isLiked ? "text-pink-500" : "text-white/20"}><Heart className={isLiked ? "fill-current" : ""} /></Button>
                     <div className="flex items-center gap-6">
                        <Button onClick={handlePlayPause} className="h-20 w-20 rounded-full bg-white text-black hover:scale-105 transition-transform">{isPlaying ? <Pause className="w-10 h-10 fill-current" /> : <Play className="w-10 h-10 fill-current ml-1" />}</Button>
                     </div>
                     <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={toggleMute} className={isMuted ? "text-red-500" : "text-white/40"}>{isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}</Button>
                        <Button onClick={() => setShowChat(!showChat)} variant="ghost" size="icon" className={showChat ? "text-pink-500" : "text-white/40"}><MessageCircle className="w-5 h-5" /></Button>
                     </div>
                   </div>
                 </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {showChat && (
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="absolute inset-0 bg-black/95 z-50 flex flex-col p-6">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-black uppercase italic">Vibe Chat</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowChat(false)} className="bg-white/5 rounded-xl"><X className="w-5 h-5" /></Button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 mb-6 custom-scrollbar">
               {chatMessages.map(msg => (
                 <div key={msg.id} className={`flex ${msg.sender === "me" ? "justify-end" : "justify-start"}`}>
                    <div className={`p-4 rounded-2xl text-xs sm:text-sm ${msg.sender === "me" ? "bg-pink-600 text-white rounded-br-none" : "bg-white/5 text-white/70 rounded-bl-none"}`}>
                      {msg.sender !== "me" && <p className="text-[8px] font-black uppercase text-pink-400 mb-1">{msg.sender}</p>}
                      {msg.text}
                    </div>
                 </div>
               ))}
               <div ref={chatEndRef} />
            </div>
            <div className="flex gap-2">
              <Input placeholder="Sync a vibe..." value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendChatMessage()} className="h-14 bg-white/5 border-white/10 rounded-2xl" />
              <Button onClick={sendChatMessage} className="h-14 w-14 bg-pink-600 rounded-2xl"><Send className="w-5 h-5" /></Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
