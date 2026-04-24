"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const getUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const username = user.user_metadata?.username;
      const res = await fetch(`/api/getUserInfo?username=${username}`);
      const data = await res.json();

      if (res.ok) {
        setFirstName(data.user.first_name);
        setIsAdmin(data.user.role === "admin");
      }
    };

    getUser();
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  return (
    <nav className="w-full border-b border-border bg-background">
      <div className="max-w-5xl mx-auto flex items-center justify-between px-5 h-16">
        <div className="flex items-center gap-8">
          <Link href="/home" className="font-semibold text-sm hover:underline underline-offset-4">
            Home
          </Link>
          <Link href="/matching" className="font-semibold text-sm hover:underline underline-offset-4">
            Matching
          </Link>
          <Link href="/profile" className="font-semibold text-sm hover:underline underline-offset-4">
            Profile
          </Link>
          <Link href="/chatrooms" className="font-semibold text-sm hover:underline underline-offset-4">
            Messages
          </Link>
          {isAdmin && (
        <Link href="/admin" className="font-semibold text-sm hover:underline underline-offset-4 text-red-500">
            Admin
        </Link>
        )}
        </div>
        <div className="flex items-center gap-4">
          {firstName && (
            <span className="text-sm">Hello, {firstName}!</span>
          )}
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Log out
          </Button>
        </div>
      </div>
    </nav>
  );
}