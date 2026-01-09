"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import {
  Video as VideoIcon,
  Phone,
  Maximize2,
  Minimize2,
  MicOff,
  Mic,
  PhoneOff,
  CameraOff,
  Camera,
  Volume2,
  VolumeX,
  SwitchCamera,
  Play,
  Pause,
  Film,
  Link,
  Upload,
  X,
  Rewind,
  FastForward,
  Settings,
  MonitorPlay,
  Users,
  MessageCircle,
  Send,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  ShieldCheck,
  Music,
  Youtube
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
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState("Initializing...");
  const [callDuration, setCallDuration] = useState(0);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment" | "any">("user");
  const [controlsVisible, setControlsVisible] = useState(true);
  const [showSetup, setShowSetup] = useState(true);
  const [videoUrl, setVideoUrl] = useState("");
  const [isYoutube, setIsYoutube] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<{id: string; text: string; sender: string; time: Date}[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [videosExpanded, setVideosExpanded] = useState(true);

  const myVideo = useRef<HTMLVideoElement>(null);
  const userVideo = useRef<HTMLVideoElement>(null);
  const remoteAudio = useRef<HTMLAudioElement>(null);
  const nativeVideoRef = useRef<HTMLVideoElement>(null);
  const ytPlayerRef = useRef<any>(null);
  const ytContainerRef = useRef<HTMLDivElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<any>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const hasAnswered = useRef(false);
  const iceCandidateQueue = useRef<RTCIceCandidateInit[]>([]);
  const remoteDescriptionSet = useRef(false);
  const controlsTimeout = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const partnerPublicKeyRef = useRef<CryptoKey | null>(null);
  const isSyncing = useRef(false);

  const getYoutubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  useEffect(() => {
    if (myVideo.current && stream) {
      myVideo.current.srcObject = stream;
      myVideo.current.play().catch(() => {});
    }
  }, [stream, showSetup, videosExpanded]);

  useEffect(() => {
    if (remoteStream) {
      if (userVideo.current) {
        userVideo.current.srcObject = remoteStream;
        userVideo.current.play().catch(() => {});
      }
      if (remoteAudio.current) {
        remoteAudio.current.srcObject = remoteStream;
        remoteAudio.current.play().catch(() => {});
      }
    }
  }, [remoteStream, showSetup, videosExpanded]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!isConnecting) setCallDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isConnecting]);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    controlsTimeout.current = setTimeout(() => {
      if (!showSetup && isPlaying) setControlsVisible(false);
    }, 4000);
  }, [showSetup, isPlaying]);

  const encryptSignal = async (data: any) => {
    if (!partnerPublicKeyRef.current && contact.public_key) {
      partnerPublicKeyRef.current = await importPublicKey(contact.public_key);
    }
    if (!partnerPublicKeyRef.current) return JSON.stringify(data);
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

  const sendSyncMessage = useCallback((action: string, data: any) => {
    if (dataChannelRef.current?.readyState === "open") {
      dataChannelRef.current.send(JSON.stringify({ action, ...data }));
    }
  }, []);

  const initYoutubePlayer = useCallback((videoId: string) => {
    if (typeof window === "undefined") return;

    const loadAPI = () => {
      if (!(window as any).YT) {
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      } else if ((window as any).YT.Player) {
        createPlayer();
      }
    };

    const createPlayer = () => {
      if (ytPlayerRef.current) {
        ytPlayerRef.current.destroy();
      }
      
      ytPlayerRef.current = new (window as any).YT.Player('yt-player-element', {
        height: '100%',
        width: '100%',
        videoId: videoId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          fs: 0,
          enablejsapi: 1
        },
        events: {
          onReady: (event: any) => {
            setDuration(event.target.getDuration());
            event.target.playVideo();
            setIsPlaying(true);
          },
          onStateChange: (event: any) => {
            if (isSyncing.current) return;
            const state = event.data;
            if (state === (window as any).YT.PlayerState.PLAYING) {
              setIsPlaying(true);
              sendSyncMessage("play", { time: event.target.getCurrentTime() });
            } else if (state === (window as any).YT.PlayerState.PAUSED) {
              setIsPlaying(false);
              sendSyncMessage("pause", { time: event.target.getCurrentTime() });
            }
          }
        }
      });
    };

    (window as any).onYouTubeIframeAPIReady = createPlayer;
    loadAPI();
  }, [sendSyncMessage]);

  const handleDataChannelMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      isSyncing.current = true;
      if (data.action === "url") {
        const ytId = getYoutubeId(data.url);
        setVideoUrl(data.url);
        setIsYoutube(!!ytId);
        setShowSetup(false);
        if (ytId) setTimeout(() => initYoutubePlayer(ytId), 500);
      } else if (data.action === "play") {
        setIsPlaying(true);
        if (isYoutube && ytPlayerRef.current) {
          ytPlayerRef.current.seekTo(data.time, true);
          ytPlayerRef.current.playVideo();
        } else if (nativeVideoRef.current) {
          nativeVideoRef.current.currentTime = data.time;
          nativeVideoRef.current.play();
        }
      } else if (data.action === "pause") {
        setIsPlaying(false);
        if (isYoutube && ytPlayerRef.current) {
          ytPlayerRef.current.pauseVideo();
        } else if (nativeVideoRef.current) {
          nativeVideoRef.current.pause();
        }
      } else if (data.action === "seek") {
        if (isYoutube && ytPlayerRef.current) {
          ytPlayerRef.current.seekTo(data.time, true);
        } else if (nativeVideoRef.current) {
          nativeVideoRef.current.currentTime = data.time;
        }
      } else if (data.action === "chat") {
        setChatMessages(prev => [...prev, { id: Date.now().toString(), text: data.message, sender: contact.username, time: new Date() }]);
      }
      setTimeout(() => { isSyncing.current = false; }, 500);
    } catch (e) {}
  }, [contact.username, initYoutubePlayer, isYoutube]);

  const createPeerConnection = useCallback((localStream: MediaStream) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }],
    });
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
    if (isInitiator) {
      const dc = pc.createDataChannel("musicTogetherSync");
      dc.onmessage = handleDataChannelMessage;
      dataChannelRef.current = dc;
    }
    pc.ondatachannel = (e) => {
      e.channel.onmessage = handleDataChannelMessage;
      dataChannelRef.current = e.channel;
    };
    pc.ontrack = (e) => {
      setRemoteStream(e.streams[0]);
      setIsConnecting(false);
      setConnectionStatus("Connected");
    };
    pc.onicecandidate = async (e) => {
      if (e.candidate) {
        const encrypted = await encryptSignal({ candidate: e.candidate.toJSON() });
        await supabase.from("calls").insert({ caller_id: userId, receiver_id: contact.id, signal_data: encrypted, type: "candidate", call_mode: "musictogether" });
      }
    };
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "connected") {
        setIsConnecting(false);
        setConnectionStatus("Connected");
      } else if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "closed") {
        onClose();
      }
    };
    return pc;
  }, [userId, contact.id, handleDataChannelMessage, isInitiator, onClose]);

  useEffect(() => {
    let active = true;
    const start = async () => {
      try {
        const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (!active) return localStream.getTracks().forEach(t => t.stop());
        setStream(localStream);
        const pc = createPeerConnection(localStream);
        peerConnection.current = pc;
        if (isInitiator) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          const encrypted = await encryptSignal({ sdp: pc.localDescription });
          await supabase.from("calls").insert({ caller_id: userId, receiver_id: contact.id, signal_data: encrypted, type: "offer", call_mode: "musictogether" });
        } else if (incomingSignal) {
          const signal = await decryptSignal(JSON.stringify(incomingSignal));
          if (signal.sdp) {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
            remoteDescriptionSet.current = true;
            while (iceCandidateQueue.current.length) {
              const c = iceCandidateQueue.current.shift();
              if (c) await pc.addIceCandidate(new RTCIceCandidate(c));
            }
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            const encrypted = await encryptSignal({ sdp: pc.localDescription });
            await supabase.from("calls").insert({ caller_id: userId, receiver_id: contact.id, signal_data: encrypted, type: "answer", call_mode: "musictogether" });
          }
        }
        const chan = supabase.channel(`music-${userId}-${contact.id}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "calls", filter: `receiver_id=eq.${userId}` }, async (p) => {
          const data = p.new;
          if (!peerConnection.current) return;
          const signal = await decryptSignal(data.signal_data);
          if (data.type === "answer" && isInitiator && signal.sdp && !hasAnswered.current) {
            hasAnswered.current = true;
            await peerConnection.current.setRemoteDescription(new RTCSessionDescription(signal.sdp));
            remoteDescriptionSet.current = true;
            while (iceCandidateQueue.current.length) {
              const c = iceCandidateQueue.current.shift();
              if (c) await peerConnection.current.addIceCandidate(new RTCIceCandidate(c));
            }
          } else if (data.type === "candidate" && signal.candidate) {
            if (remoteDescriptionSet.current) await peerConnection.current.addIceCandidate(new RTCIceCandidate(signal.candidate));
            else iceCandidateQueue.current.push(signal.candidate);
          } else if (data.type === "end") onClose();
        }).subscribe();
        channelRef.current = chan;
      } catch (err) { onClose(); }
    };
    start();
    return () => { active = false; if (stream) stream.getTracks().forEach(t => t.stop()); if (peerConnection.current) peerConnection.current.close(); if (channelRef.current) supabase.removeChannel(channelRef.current); };
  }, []);

  const handleUrlSubmit = () => {
    if (videoUrl.trim()) {
      const ytId = getYoutubeId(videoUrl);
      setIsYoutube(!!ytId);
      sendSyncMessage("url", { url: videoUrl });
      setShowSetup(false);
      if (ytId) setTimeout(() => initYoutubePlayer(ytId), 500);
    }
  };

  const handlePlayPause = () => {
    if (isYoutube && ytPlayerRef.current) {
      if (isPlaying) ytPlayerRef.current.pauseVideo();
      else ytPlayerRef.current.playVideo();
      setIsPlaying(!isPlaying);
      sendSyncMessage(isPlaying ? "pause" : "play", { time: ytPlayerRef.current.getCurrentTime() });
    } else if (nativeVideoRef.current) {
      if (isPlaying) nativeVideoRef.current.pause();
      else nativeVideoRef.current.play();
      setIsPlaying(!isPlaying);
      sendSyncMessage(isPlaying ? "pause" : "play", { time: nativeVideoRef.current.currentTime });
    }
  };

  const handleSeek = (val: number[]) => {
    if (isYoutube && ytPlayerRef.current) {
      ytPlayerRef.current.seekTo(val[0], true);
      sendSyncMessage("seek", { time: val[0] });
    } else if (nativeVideoRef.current) {
      nativeVideoRef.current.currentTime = val[0];
      sendSyncMessage("seek", { time: val[0] });
    }
  };

  const sendChatMessage = () => {
    if (chatInput.trim()) {
      setChatMessages(prev => [...prev, { id: Date.now().toString(), text: chatInput.trim(), sender: "me", time: new Date() }]);
      sendSyncMessage("chat", { message: chatInput.trim() });
      setChatInput("");
    }
  };

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (isPlaying) {
        if (isYoutube && ytPlayerRef.current) setCurrentTime(ytPlayerRef.current.getCurrentTime());
        else if (nativeVideoRef.current) setCurrentTime(nativeVideoRef.current.currentTime);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying, isYoutube]);

  return (
    <div ref={containerRef} className="fixed inset-0 z-[100] bg-black text-white overflow-hidden" onClick={showControls} onMouseMove={showControls}>
      <audio ref={remoteAudio} autoPlay playsInline />
      {showSetup ? (
        <div className="absolute inset-0 flex flex-col bg-zinc-950 p-6 items-center justify-center">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-lg bg-zinc-900 border border-white/10 rounded-3xl p-8 space-y-6 text-center">
            <div className="p-4 bg-indigo-600/20 rounded-2xl inline-block mb-4"><Music className="w-12 h-12 text-indigo-400" /></div>
            <h2 className="text-3xl font-black uppercase italic italic">Music Together</h2>
            <p className="text-white/40">Paste a YouTube link or video URL to watch with {contact.username}</p>
            <div className="flex flex-col gap-4">
              <div className="flex gap-2">
                <Input placeholder="YouTube link or Video URL..." value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} className="bg-white/5 border-white/10 h-14 rounded-2xl" />
                <Button onClick={handleUrlSubmit} className="bg-indigo-600 h-14 px-8 rounded-2xl font-black uppercase">Start</Button>
              </div>
              <div className="flex items-center gap-2 justify-center p-3 bg-white/5 rounded-xl">
                <Avatar className="h-8 w-8"><AvatarImage src={contact.avatar_url} /><AvatarFallback>{contact.username?.[0]}</AvatarFallback></Avatar>
                <p className="text-xs font-bold uppercase tracking-widest">{contact.username} • {connectionStatus}</p>
              </div>
              <Button variant="ghost" onClick={onClose} className="text-red-400 uppercase font-black text-xs">Cancel</Button>
            </div>
          </motion.div>
        </div>
      ) : (
        <div className="h-full relative flex flex-col">
          <div className="flex-1 relative">
            {isYoutube ? (
              <div id="yt-player-element" className="w-full h-full" />
            ) : (
              <video ref={nativeVideoRef} src={videoUrl} className="w-full h-full object-contain" onLoadedMetadata={() => setDuration(nativeVideoRef.current?.duration || 0)} playsInline />
            )}
            
            <AnimatePresence>
              {controlsVisible && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent flex flex-col justify-end p-6">
                   <div className="flex items-center gap-4 mb-4">
                    <span className="text-xs font-mono text-white/60">{Math.floor(currentTime/60)}:{Math.floor(currentTime%60).toString().padStart(2,'0')}</span>
                    <Slider value={[currentTime]} max={duration || 100} onValueChange={handleSeek} className="flex-1" />
                    <span className="text-xs font-mono text-white/60">{Math.floor(duration/60)}:{Math.floor(duration%60).toString().padStart(2,'0')}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                       <Button onClick={handlePlayPause} size="icon" className="h-16 w-16 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/10">
                        {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
                      </Button>
                      <Button variant="ghost" onClick={() => setShowSetup(true)} className="text-white/40 hover:text-white uppercase font-black text-xs">Change Video</Button>
                    </div>
                    <div className="flex items-center gap-2">
                       <Button onClick={() => setShowChat(!showChat)} className={`h-12 px-6 rounded-2xl uppercase font-black text-xs ${showChat ? 'bg-indigo-600' : 'bg-white/5'}`}>Chat</Button>
                       <Button onClick={onClose} className="h-12 w-12 rounded-full bg-red-600 hover:bg-red-700"><PhoneOff className="w-5 h-5" /></Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="absolute top-6 left-6 flex gap-4 z-20">
            <div className="w-32 aspect-[3/4] bg-zinc-900 rounded-2xl overflow-hidden border-2 border-white/10 relative">
              <video ref={myVideo} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: "scaleX(-1)" }} />
              <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-0.5 rounded-full text-[8px] font-black uppercase">You</div>
            </div>
            <div className="w-32 aspect-[3/4] bg-zinc-900 rounded-2xl overflow-hidden border-2 border-indigo-500/50 relative">
              <video ref={userVideo} autoPlay playsInline className="w-full h-full object-cover" />
              <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-0.5 rounded-full text-[8px] font-black uppercase">{contact.username}</div>
            </div>
          </div>

          <AnimatePresence>
            {showChat && (
              <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} className="absolute top-0 right-0 bottom-0 w-80 bg-zinc-900/95 border-l border-white/10 p-4 flex flex-col z-30">
                <div className="flex items-center justify-between mb-4"><h3 className="font-black uppercase italic">Party Chat</h3><Button variant="ghost" size="icon" onClick={() => setShowChat(false)}><X className="w-4 h-4" /></Button></div>
                <div className="flex-1 overflow-y-auto space-y-3 mb-4 custom-scrollbar">
                  {chatMessages.map(m => (
                    <div key={m.id} className={`flex flex-col ${m.sender === 'me' ? 'items-end' : 'items-start'}`}>
                      <div className={`p-3 rounded-2xl text-xs max-w-[90%] ${m.sender === 'me' ? 'bg-indigo-600 text-white' : 'bg-white/5 text-white'}`}>
                        {m.text}
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <div className="flex gap-2">
                  <Input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChatMessage()} placeholder="Say something..." className="bg-white/5 border-white/10 rounded-xl" />
                  <Button onClick={sendChatMessage} className="bg-indigo-600 rounded-xl"><Send className="w-4 h-4" /></Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
