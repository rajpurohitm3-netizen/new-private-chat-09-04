"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { MusicTogether } from "@/components/MusicTogether";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Shield } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function MusicTogetherPage() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#010101]">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-16 h-16 border-t-2 border-indigo-500 rounded-full"
        />
      </div>
    );
  }

  if (!session) {
    router.push("/");
    return null;
  }

  return (
    <main className="h-screen bg-[#010101] flex flex-col overflow-hidden">
      <header className="h-20 border-b border-white/5 bg-[#050505]/80 backdrop-blur-3xl flex items-center justify-between px-6 z-30 shrink-0">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => router.push("/")}
            className="text-white/40 hover:text-white"
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <div className="flex items-center gap-3">
             <div className="p-2 bg-indigo-600 rounded-lg">
                <Shield className="w-4 h-4 text-white" />
             </div>
             <h1 className="text-lg font-black italic tracking-tighter uppercase">Chatify <span className="text-indigo-500">Music</span></h1>
          </div>
        </div>
      </header>

      <div className="flex-1">
        <MusicTogether />
      </div>
    </main>
  );
}
