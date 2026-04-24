"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Bell, Search } from "lucide-react";

type SearchResult = {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
};

type Notification = {
  chat_room_id: string;
  message_id: string;
  message_text: string;
  sender_name: string;
  sender_profile_picture: string | null;
  unread_count: number;
};

type MessageRequest = {
  chat_room_id: string;
  sender_name: string;
  sender_profile_picture: string | null;
};

export function Navbar() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [messageRequests, setMessageRequests] = useState<MessageRequest[]>([]);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async (userId: string) => {
    const supabase = createClient();

    // Unread messages
    const { data: messages } = await supabase
      .from("messages")
      .select("message_id, sender_id, chat_room_id, message_text")
      .eq("receiver_id", userId)
      .eq("is_read", false)
      .order("created_at", { ascending: false });

    if (messages && messages.length > 0) {
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
    } else {
      setNotifications([]);
    }

    // Pending message requests sent TO the current user
    const chatroomRes = await fetch(`/api/chatroom?user_id=${userId}`);
    if (chatroomRes.ok) {
      const chatroomData = await chatroomRes.json();
      const pending = (chatroomData.chatrooms ?? []).filter(
        (c: { status: string; created_by: string }) =>
          c.status === "pending" && c.created_by !== userId
      );

      if (pending.length > 0) {
        const senderIds = pending.map((c: { created_by: string }) => c.created_by);
        const { data: senders } = await supabase
          .from("users")
          .select("id, first_name, last_name, profile_picture")
          .in("id", senderIds);

        const sendersMap = new Map((senders ?? []).map((s) => [s.id, s]));

        setMessageRequests(
          pending.map((c: { chat_room_id: string; created_by: string }) => {
            const sender = sendersMap.get(c.created_by);
            return {
              chat_room_id: c.chat_room_id,
              sender_name: sender ? `${sender.first_name} ${sender.last_name}` : "Unknown",
              sender_profile_picture: sender?.profile_picture ?? null,
            };
          })
        );
      } else {
        setMessageRequests([]);
      }
    }
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

  // Close notification dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close search dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      const res = await fetch(`/api/searchUsers?query=${encodeURIComponent(searchQuery.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults((data.users ?? []).slice(0, 5));
        setSearchOpen(true);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchOpen(false);
    router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  const handleSearchResultClick = (username: string) => {
    setSearchOpen(false);
    setSearchQuery("");
    router.push(`/search?q=${encodeURIComponent(username)}`);
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  const handleNotificationClick = (chatRoomId: string) => {
    setOpen(false);
    router.push(`/chat/${chatRoomId}`);
  };

  const handleRequestClick = () => {
    setOpen(false);
    router.push("/chatrooms");
  };

  const totalCount =
    notifications.reduce((sum, n) => sum + n.unread_count, 0) + messageRequests.length;

  const hasAny = notifications.length > 0 || messageRequests.length > 0;

  return (
    <nav className="w-full border-b border-border bg-background">
      <div className="max-w-5xl mx-auto flex items-center justify-between px-5 h-16 gap-4">
        <div className="flex items-center gap-6 shrink-0">
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

        {/* Search bar */}
        <div ref={searchRef} className="relative flex-1 max-w-xs">
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
              className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </form>

          {searchOpen && searchResults.length > 0 && (
            <div className="absolute top-full mt-1 w-full bg-background border border-border rounded-lg shadow-lg z-50 overflow-hidden">
              {searchResults.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleSearchResultClick(user.username)}
                  className="w-full flex flex-col px-3 py-2 hover:bg-muted transition-colors text-left"
                >
                  <span className="text-sm font-medium">{user.first_name} {user.last_name}</span>
                  <span className="text-xs text-muted-foreground">@{user.username}</span>
                </button>
              ))}
              <button
                onClick={() => {
                  setSearchOpen(false);
                  router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
                }}
                className="w-full px-3 py-2 text-xs text-center text-muted-foreground hover:bg-muted border-t border-border transition-colors"
              >
                See all results for &quot;{searchQuery}&quot;
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 shrink-0">
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
              {totalCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-4 h-4 flex items-center justify-center px-0.5">
                  {totalCount > 99 ? "99+" : totalCount}
                </span>
              )}
            </button>

            {open && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-background border border-border rounded-lg shadow-lg z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <p className="text-sm font-semibold">Notifications</p>
                </div>

                {!hasAny ? (
                  <div className="px-4 py-6 text-center">
                    <p className="text-sm text-muted-foreground">No new notifications</p>
                  </div>
                ) : (
                  <div className="max-h-80 overflow-y-auto">
                    {/* Message requests */}
                    {messageRequests.length > 0 && (
                      <div>
                        <p className="px-4 pt-3 pb-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                          Message Requests
                        </p>
                        <div className="divide-y divide-border">
                          {messageRequests.map((req) => (
                            <button
                              key={req.chat_room_id}
                              onClick={handleRequestClick}
                              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors text-left"
                            >
                              <div className="w-9 h-9 rounded-full border overflow-hidden bg-muted flex items-center justify-center shrink-0">
                                {req.sender_profile_picture ? (
                                  <img
                                    src={req.sender_profile_picture}
                                    alt={req.sender_name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <span className="text-xs text-muted-foreground font-medium">
                                    {req.sender_name[0]?.toUpperCase() ?? "?"}
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">{req.sender_name}</p>
                                <p className="text-xs text-muted-foreground">Sent you a message request</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Unread messages */}
                    {notifications.length > 0 && (
                      <div>
                        {messageRequests.length > 0 && (
                          <p className="px-4 pt-3 pb-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                            Unread Messages
                          </p>
                        )}
                        <div className="divide-y divide-border">
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
                      </div>
                    )}
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
