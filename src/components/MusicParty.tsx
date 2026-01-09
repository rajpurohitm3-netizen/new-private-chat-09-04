"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import {
  Music,
  PhoneOff,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Link,
  Upload,
  X,
  Rewind,
  FastForward,
  MessageCircle,
  Send,
  Users,
  Disc,
  MicOff,
  Mic,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { encryptMessage, decryptMessage, importPublicKey } from "@/lib/crypto";
import ReactPlayer from "react-player";

interface MusicPartyProps {
  contact: any;
  onClose: () => void;
  userId: string;
  privateKey: CryptoKey;
  isInitiator?: boolean;
  incomingSignal?: any;
}

export function MusicParty({
  contact,
  onClose,
  userId,
  privateKey,
  isInitiator = true,
  incomingSignal,
}: MusicPartyProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState("Initializing...");
  const [showSetup, setShowSetup] = useState(true);
  const [musicUrl, setMusicUrl] = useState("");
  const [localMusicUrl, setLocalMusicUrl] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ id: string; text: string; sender: string; time: Date }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [sendingFile, setSendingFile] = useState(false);
  const [fileProgress, setFileProgress] = useState(0);
  const [receivingFile, setReceivingFile] = useState(false);

  const playerRef = useRef<ReactPlayer>(null);
  const remoteAudio = useRef<HTMLAudioElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<any>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const hasAnswered = useRef(false);
  const iceCandidateQueue = useRef<RTCIceCandidateInit[]>([]);
  const remoteDescriptionSet = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileChunksRef = useRef<ArrayBuffer[]>([]);
  const expectedChunksRef = useRef<number>(0);
  const receivedChunksCountRef = useRef<number>(0);
  const partnerPublicKeyRef = useRef<CryptoKey | null>(null);

  const sendSyncMessage = useCallback((action: string, data: any) => {
    if (dataChannelRef.current && dataChannelRef.current.readyState === "open") {
      dataChannelRef.current.send(JSON.stringify({ action, ...data }));
    }
  }, []);

  const updateMediaSession = useCallback((title: string) => {
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist: contact.username,
        album: "Music Together",
        artwork: [
          { src: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=500&q=80", sizes: "512x512", type: "image/jpeg" }
        ]
      });

      navigator.mediaSession.setActionHandler("play", () => {
        setIsPlaying(true);
        sendSyncMessage("play", { time: currentTime });
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        setIsPlaying(false);
        sendSyncMessage("pause", { time: currentTime });
      });
    }
  }, [contact.username, currentTime, sendSyncMessage]);

  const sendMusicFile = useCallback(async (file: File) => {
    if (!dataChannelRef.current || dataChannelRef.current.readyState !== "open") {
      toast.error("Connection not ready");
      return;
    }

    setSendingFile(true);
    setFileProgress(0);

    const CHUNK_SIZE = 16384;
    const arrayBuffer = await file.arrayBuffer();
    const totalChunks = Math.ceil(arrayBuffer.byteLength / CHUNK_SIZE);

    sendSyncMessage("fileStart", {
      totalSize: arrayBuffer.byteLength,
      totalChunks,
      fileName: file.name,
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
          await new Promise((resolve) => setTimeout(resolve, 50));
        }

        dataChannelRef.current.send(chunk);
        setFileProgress(Math.round(((i + 1) / totalChunks) * 100));
      }

      sendSyncMessage("fileEnd", {});
      toast.success("Music shared with partner!");
    } catch (err) {
      console.error("File transfer failed:", err);
      toast.error("Sharing interrupted");
    } finally {
      setSendingFile(false);
    }
  }, [sendSyncMessage]);

  const handleDataChannelMessage = useCallback((event: MessageEvent) => {
    if (event.data instanceof ArrayBuffer) {
      fileChunksRef.current.push(event.data);
      receivedChunksCountRef.current++;
      setFileProgress(Math.round((receivedChunksCountRef.current / expectedChunksRef.current) * 100));
      return;
    }

    try {
      const data = JSON.parse(event.data);
      if (data.action === "fileStart") {
        setReceivingFile(true);
        expectedChunksRef.current = data.totalChunks;
        fileChunksRef.current = [];
        receivedChunksCountRef.current = 0;
        setFileProgress(0);
        toast.info(`Receiving music: ${data.fileName}`);
      } else if (data.action === "fileEnd") {
        const blob = new Blob(fileChunksRef.current, { type: "audio/mpeg" });
        const url = URL.createObjectURL(blob);
        setLocalMusicUrl(url);
        setShowSetup(false);
        setReceivingFile(false);
        fileChunksRef.current = [];
        toast.success("Music received! Ready to play.");
        updateMediaSession("Shared Track");
      } else if (data.action === "play") {
        setIsPlaying(true);
        playerRef.current?.seekTo(data.time);
      } else if (data.action === "pause") {
        setIsPlaying(false);
        playerRef.current?.seekTo(data.time);
      } else if (data.action === "seek") {
        playerRef.current?.seekTo(data.time);
      } else if (data.action === "url") {
        setMusicUrl(data.url);
        setShowSetup(false);
        updateMediaSession("YouTube Stream");
      } else if (data.action === "chat") {
        setChatMessages((prev) => [
          ...prev,
          { id: Date.now().toString(), text: data.message, sender: contact.username, time: new Date() },
        ]);
      }
    } catch (e) {
      console.error("Failed to parse message:", e);
    }
  }, [contact.username, updateMediaSession]);

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
        const dataChannel = pc.createDataChannel("musicSync");
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
            call_mode: "musicparty",
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
            call_mode: "musicparty",
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
              call_mode: "musicparty",
            });
          }
        }

        const channelId = [userId, contact.id].sort().join("-");
        const channel = supabase
          .channel(`musicparty-${channelId}`)
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
        toast.error("Music Together failed. Check microphone.");
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
      const url = URL.createObjectURL(file);
      setLocalMusicUrl(url);
      setShowSetup(false);
      sendMusicFile(file);
      updateMediaSession(file.name);
    }
  };

  const handleUrlSubmit = () => {
    if (musicUrl.trim()) {
      sendSyncMessage("url", { url: musicUrl });
      setShowSetup(false);
      updateMediaSession("YouTube Stream");
    }
  };

  const handlePlayPause = () => {
    const newPlaying = !isPlaying;
    setIsPlaying(newPlaying);
    sendSyncMessage(newPlaying ? "play" : "pause", { time: playerRef.current?.getCurrentTime() || 0 });
  };

  const handleSeek = (value: number[]) => {
    playerRef.current?.seekTo(value[0]);
    sendSyncMessage("seek", { time: value[0] });
  };

  const skip = (seconds: number) => {
    const newTime = (playerRef.current?.getCurrentTime() || 0) + seconds;
    playerRef.current?.seekTo(newTime);
    sendSyncMessage("seek", { time: newTime });
  };

  const sendChatMessage = () => {
    if (chatInput.trim()) {
      setChatMessages((prev) => [...prev, { id: Date.now().toString(), text: chatInput.trim(), sender: "me", time: new Date() }]);
      sendSyncMessage("chat", { message: chatInput.trim() });
      setChatInput("");
    }
  };

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  useEffect(() => {
    if (remoteAudio.current && remoteStream) {
      remoteAudio.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  return (
    <div className="fixed inset-0 z-[100] bg-[#030303] flex flex-col">
      <audio ref={remoteAudio} autoPlay playsInline />
      
      <AnimatePresence mode="wait">
        {showSetup ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-md space-y-8 bg-zinc-900/50 p-10 rounded-[3rem] border border-white/5 backdrop-blur-xl text-center">
              <div className="w-24 h-24 mx-auto bg-gradient-to-br from-pink-500 to-violet-600 rounded-3xl flex items-center justify-center shadow-2xl">
                <Music className="w-12 h-12 text-white" />
              </div>
              <h2 className="text-3xl font-black uppercase italic tracking-tighter">Music Together</h2>
              
              <div className="flex items-center justify-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                <Avatar className="h-12 w-12 border-2 border-pink-500/50">
                   <AvatarImage src={contact.avatar_url} />
                   <AvatarFallback>{contact.username?.[0]}</AvatarFallback>
                </Avatar>
                <div className="text-left">
                  <p className="font-black uppercase text-sm">{contact.username}</p>
                  <p className="text-[10px] font-bold text-emerald-500 uppercase">{connectionStatus}</p>
                </div>
              </div>

              {receivingFile || sendingFile ? (
                <div className="space-y-4">
                  <p className="text-xs font-bold text-white/40 uppercase">{receivingFile ? "Receiving Music..." : "Sending Music..."}</p>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <motion.div className="h-full bg-pink-500" initial={{ width: 0 }} animate={{ width: `${fileProgress}%` }} />
                  </div>
                </div>
              ) : isInitiator ? (
                <div className="space-y-4">
                  <input type="file" ref={fileInputRef} accept="audio/*" onChange={handleFileSelect} className="hidden" />
                  <Button onClick={() => fileInputRef.current?.click()} disabled={isConnecting} className="w-full h-16 bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] rounded-2xl text-white font-black uppercase tracking-widest text-[10px]">
                    <Upload className="w-4 h-4 mr-3 text-pink-500" /> Upload Music
                  </Button>
                  <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5" /></div>
                    <span className="relative bg-[#121212] px-3 text-[8px] font-black text-white/20 uppercase">OR</span>
                  </div>
                  <div className="flex gap-2">
                    <Input placeholder="YouTube Link..." value={musicUrl} onChange={(e) => setMusicUrl(e.target.value)} className="h-14 bg-white/5 border-white/10 rounded-2xl pl-6 text-sm" />
                    <Button onClick={handleUrlSubmit} disabled={!musicUrl.trim() || isConnecting} className="h-14 px-6 bg-pink-600 rounded-2xl font-black uppercase text-xs">Play</Button>
                  </div>
                </div>
              ) : (
                <div className="py-8 animate-pulse">
                  <Disc className="w-16 h-16 text-white/10 mx-auto mb-4" />
                  <p className="text-xs font-bold text-white/30 uppercase tracking-widest">Waiting for partner...</p>
                </div>
              )}
              
              <Button onClick={endCall} variant="ghost" className="w-full text-red-500/60 hover:text-red-500 font-black uppercase text-[10px] tracking-widest">End Session</Button>
            </div>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col p-6 relative">
            <div className="flex-1 flex flex-col items-center justify-center space-y-12">
               <motion.div animate={{ rotate: isPlaying ? 360 : 0 }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }} className="relative">
                  <div className="w-64 h-64 sm:w-80 sm:h-80 rounded-full bg-zinc-900 border-8 border-zinc-800 flex items-center justify-center shadow-[0_0_100px_rgba(236,72,153,0.15)] overflow-hidden">
                     <div className="absolute inset-0 bg-gradient-to-br from-pink-500/10 via-transparent to-violet-600/10" />
                     <Disc className="w-40 h-40 text-white/5" />
                     <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-24 h-24 rounded-full bg-zinc-950 border-4 border-zinc-800 flex items-center justify-center">
                           <Avatar className="h-16 w-16">
                              <AvatarImage src={contact.avatar_url} />
                              <AvatarFallback>{contact.username?.[0]}</AvatarFallback>
                           </Avatar>
                        </div>
                     </div>
                  </div>
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="absolute inset-0 rounded-full border border-white/5 pointer-events-none" style={{ margin: `${(i+1)*20}px` }} />
                  ))}
               </motion.div>

               <div className="text-center space-y-2">
                  <h3 className="text-xl font-black uppercase italic tracking-tight">{isPlaying ? "Streaming Together" : "Session Paused"}</h3>
                  <div className="flex items-center justify-center gap-2">
                     <div className={`w-1.5 h-1.5 rounded-full ${isConnecting ? 'bg-amber-500' : 'bg-emerald-500'} animate-pulse`} />
                     <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Secure Synchronized Node</span>
                  </div>
               </div>

               <div className="w-full max-w-md space-y-8">
                  <div className="space-y-2">
                     <Slider value={[currentTime]} max={duration || 100} step={0.1} onValueChange={handleSeek} className="cursor-pointer" />
                     <div className="flex justify-between text-[10px] font-mono text-white/20 uppercase tracking-widest">
                        <span>{Math.floor(currentTime/60)}:{(currentTime%60).toFixed(0).padStart(2,'0')}</span>
                        <span>{Math.floor(duration/60)}:{(duration%60).toFixed(0).padStart(2,'0')}</span>
                     </div>
                  </div>

                  <div className="flex items-center justify-center gap-8">
                     <Button variant="ghost" size="icon" onClick={() => skip(-10)} className="h-12 w-12 rounded-full hover:bg-white/5"><Rewind className="w-6 h-6" /></Button>
                     <Button onClick={handlePlayPause} className="h-20 w-20 rounded-full bg-white text-black hover:scale-105 shadow-2xl transition-all">
                        {isPlaying ? <Pause className="w-10 h-10 fill-current" /> : <Play className="w-10 h-10 fill-current ml-1" />}
                     </Button>
                     <Button variant="ghost" size="icon" onClick={() => skip(10)} className="h-12 w-12 rounded-full hover:bg-white/5"><FastForward className="w-6 h-6" /></Button>
                  </div>

                  <div className="flex items-center justify-center gap-6 pt-4">
                     <Button variant="ghost" size="icon" onClick={toggleMute} className={`h-12 w-12 rounded-full ${isMuted ? 'text-red-500 bg-red-500/10' : 'text-white/20'}`}>
                        {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                     </Button>
                     <Button variant="ghost" size="icon" onClick={() => setShowChat(!showChat)} className={`h-12 w-12 rounded-full ${showChat ? 'text-pink-500 bg-pink-500/10' : 'text-white/20'}`}>
                        <MessageCircle className="w-5 h-5" />
                     </Button>
                     <Button onClick={endCall} variant="ghost" size="icon" className="h-12 w-12 rounded-full bg-red-500/20 text-red-500">
                        <PhoneOff className="w-5 h-5" />
                     </Button>
                  </div>
               </div>
            </div>

            <div className="hidden">
              <ReactPlayer ref={playerRef} url={localMusicUrl || musicUrl} playing={isPlaying} volume={volume} onProgress={(s) => setCurrentTime(s.playedSeconds)} onDuration={setDuration} height={0} width={0} />
            </div>

            <AnimatePresence>
              {showChat && (
                <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} className="absolute top-0 right-0 bottom-0 w-full sm:w-80 bg-black/95 backdrop-blur-xl border-l border-white/5 flex flex-col z-50">
                   <div className="p-6 border-b border-white/5 flex justify-between items-center">
                      <h3 className="text-xs font-black uppercase tracking-widest">Session Chat</h3>
                      <Button variant="ghost" size="icon" onClick={() => setShowChat(false)}><X className="w-4 h-4" /></Button>
                   </div>
                   <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                      {chatMessages.map(msg => (
                        <div key={msg.id} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                           <div className={`max-w-[80%] p-3 rounded-2xl text-xs ${msg.sender === 'me' ? 'bg-pink-600 rounded-br-none' : 'bg-white/5 rounded-bl-none'}`}>
                              <p>{msg.text}</p>
                           </div>
                        </div>
                      ))}
                      <div ref={chatEndRef} />
                   </div>
                   <div className="p-4 border-t border-white/5 flex gap-2">
                      <Input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChatMessage()} placeholder="Signal..." className="bg-white/5 border-white/10 rounded-xl text-xs" />
                      <Button onClick={sendChatMessage} size="icon" className="bg-pink-600 rounded-xl"><Send className="w-4 h-4" /></Button>
                   </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
