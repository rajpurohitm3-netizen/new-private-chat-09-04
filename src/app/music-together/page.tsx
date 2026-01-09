"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { MusicTogether } from "@/components/MusicTogether";
import { PasswordGate } from "@/components/PasswordGate";
import { Shield, Music, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function MusicTogetherPage() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAppUnlocked, setIsAppUnlocked] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unlocked = sessionStorage.getItem("app_unlocked") === "true";
    setIsAppUnlocked(unlocked);

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
  }, []);

  const handleAppUnlock = () => {
    sessionStorage.setItem("app_unlocked", "true");
    setIsAppUnlocked(true);
  };

  if (!isAppUnlocked) {
    return (
      <PasswordGate 
        correctPassword="162008" 
        onUnlock={handleAppUnlock}
        title="Chatify"
        subtitle="Music Terminal"
        description="Authorization required to initialize audio stream."
      />
    );
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#010101]">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-16 h-16 border-t-2 border-pink-500 rounded-full"
        />
      </div>
    );
  }

  if (!session) {
    router.push("/");
    return null;
  }

  return (
    <main className="min-h-screen bg-[#010101] text-white p-4 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-5xl flex items-center justify-between mb-8">
        <Button 
          variant="ghost" 
          onClick={() => router.push("/")}
          className="text-white/40 hover:text-white"
        >
          <ChevronLeft className="w-5 h-5 mr-2" />
          Back to Dashboard
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-pink-600/20 rounded-xl">
            <Music className="w-5 h-5 text-pink-500" />
          </div>
          <h1 className="text-xl font-black uppercase italic tracking-tighter">Music <span className="text-pink-500">Together</span></h1>
        </div>
        <div className="w-24 hidden md:block" />
      </div>

      <div className="w-full max-w-4xl aspect-video md:aspect-[21/9] min-h-[600px]">
        <MusicTogether />
      </div>

      <div className="mt-8 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.5em] text-white/10 flex items-center gap-3 justify-center">
          <Shield className="w-3 h-3" />
          Secure Neural Audio Stream v2.0
        </p>
      </div>
    </main>
  );
}
