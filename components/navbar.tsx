"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";

type Notification = {
  chat_room_id: string;
  message_id: string;
  message_text: string;
  sender_name: string;
  sender_profile_picture: string | null;
  unread_count: number;
};

export function Navbar() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async (userId: string) => {
    const supabase = createClient();

    const { data: messages } = await supabase
      .from("messages")
      .select("message_id, sender_id, chat_room_id, message_text")
      .eq("receiver_id", userId)
      .eq("is_read", false)
      .order("created_at", { ascending: false });

    if (!messages || messages.length === 0) {
      setNotifications([]);
      return;
    }

    // One entry per chatroom — most recent unread message is first (desc order)
    const byRoom = new Map<string, { msg: typeof messages[0]; count: number }>();
    for (const msg of messages) {
      const entry = byRoom.get(msg.chat_room_id);
      if (!entry) {
        byRoom.set(msg.chat_room_id, { msg, count: 1 });
      } else {
        entry.count += 1;
      }
    }

    const senderIds = [...new Set(messages.map((m) => m.sender_id))];
    const { data: senders } = await supabase
      .from("users")
      .select("id, first_name, last_name, profile_picture")
      .in("id", senderIds);

    const sendersMap = new Map((senders ?? []).map((s) => [s.id, s]));

    setNotifications(
      Array.from(byRoom.values()).map(({ msg, count }) => {
        const sender = sendersMap.get(msg.sender_id);
        return {
          chat_room_id: msg.chat_room_id,
          message_id: msg.message_id,
          message_text: msg.message_text,
          sender_name: sender ? `${sender.first_name} ${sender.last_name}` : "Unknown",
          sender_profile_picture: sender?.profile_picture ?? null,
          unread_count: count,
        };
      })
    );
  }, []);

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
        setCurrentUserId(data.user.id);
        fetchNotifications(data.user.id);
      }
    };

    getUser();
  }, [fetchNotifications]);

  // Poll every 15 seconds
  useEffect(() => {
    if (!currentUserId) return;
    const interval = setInterval(() => fetchNotifications(currentUserId), 15000);
    return () => clearInterval(interval);
  }, [currentUserId, fetchNotifications]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  const handleNotificationClick = (chatRoomId: string) => {
    setOpen(false);
    router.push(`/chat/${chatRoomId}`);
  };

  const totalUnread = notifications.reduce((sum, n) => sum + n.unread_count, 0);

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

          {/* Notification bell */}
          <div ref={dropdownRef} className="relative">
            <button
              onClick={() => setOpen((prev) => !prev)}
              className="relative p-1.5 rounded-md hover:bg-muted transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              {totalUnread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-4 h-4 flex items-center justify-center px-0.5">
                  {totalUnread > 99 ? "99+" : totalUnread}
                </span>
              )}
            </button>

            {open && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-background border border-border rounded-lg shadow-lg z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <p className="text-sm font-semibold">Notifications</p>
                </div>

                {notifications.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <p className="text-sm text-muted-foreground">No unread messages</p>
                  </div>
                ) : (
                  <div className="max-h-72 overflow-y-auto divide-y divide-border">
                    {notifications.map((notif) => (
                      <button
                        key={notif.chat_room_id}
                        onClick={() => handleNotificationClick(notif.chat_room_id)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors text-left"
                      >
                        <div className="w-9 h-9 rounded-full border overflow-hidden bg-muted flex items-center justify-center shrink-0">
                          {notif.sender_profile_picture ? (
                            <img
                              src={notif.sender_profile_picture}
                              alt={notif.sender_name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground font-medium">
                              {notif.sender_name[0]?.toUpperCase() ?? "?"}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium truncate">{notif.sender_name}</p>
                            {notif.unread_count > 1 && (
                              <span className="text-[10px] bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 shrink-0">
                                {notif.unread_count}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {notif.message_text.length > 30
                              ? notif.message_text.slice(0, 30) + "..."
                              : notif.message_text}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <Button variant="outline" size="sm" onClick={handleLogout}>
            Log out
          </Button>
        </div>
      </div>
    </nav>
  );
}
