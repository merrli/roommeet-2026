"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Navbar } from "@/components/navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type OtherUser = {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  profile_picture: string | null;
};

type Chatroom = {
  chat_room_id: string;
  status: "pending" | "active";
  created_by: string;
  user_1: string;
  user_2: string;
  otherUser: OtherUser | null;
};

export default function ChatroomsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [chatrooms, setChatrooms] = useState<Chatroom[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth/login");
        return;
      }

      const username = user.user_metadata?.username;
      const res = await fetch(`/api/getUserInfo?username=${username}`);
      const data = await res.json();
      if (!res.ok) { setLoading(false); return; }

      const currentId: string = data.user.id;
      setCurrentUserId(currentId);

      const chatroomRes = await fetch(`/api/chatroom?user_id=${currentId}`);
      const chatroomData = await chatroomRes.json();
      if (!chatroomRes.ok) { setLoading(false); return; }

      const rooms: Omit<Chatroom, "otherUser">[] = chatroomData.chatrooms ?? [];

      if (rooms.length === 0) {
        setChatrooms([]);
        setLoading(false);
        return;
      }

      const otherIds = rooms.map((r) =>
        r.user_1 === currentId ? r.user_2 : r.user_1
      );

      const { data: usersData } = await supabase
        .from("users")
        .select("id, username, first_name, last_name, profile_picture")
        .in("id", otherIds);

      const usersMap = new Map((usersData ?? []).map((u) => [u.id, u]));

      setChatrooms(
        rooms.map((r) => {
          const otherId = r.user_1 === currentId ? r.user_2 : r.user_1;
          return { ...r, otherUser: usersMap.get(otherId) ?? null };
        })
      );

      setLoading(false);
    };

    load();
  }, [router]);

  const handleAccept = async (chatRoomId: string) => {
    setPendingAction(chatRoomId);
    await fetch("/api/chatroom", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_room_id: chatRoomId, status: "active" }),
    });
    setChatrooms((prev) =>
      prev.map((c) =>
        c.chat_room_id === chatRoomId ? { ...c, status: "active" } : c
      )
    );
    setPendingAction(null);
  };

  const handleDecline = async (chatRoomId: string) => {
    setPendingAction(chatRoomId);
    await fetch("/api/chatroom", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_room_id: chatRoomId, status: "declined" }),
    });
    setChatrooms((prev) => prev.filter((c) => c.chat_room_id !== chatRoomId));
    setPendingAction(null);
  };

  const active = chatrooms.filter((c) => c.status === "active");
  const pending = chatrooms.filter((c) => c.status === "pending");

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  function ConversationCard({ chatroom }: { chatroom: Chatroom }) {
    const { otherUser } = chatroom;
    const isActive = chatroom.status === "active";
    const isMine = chatroom.created_by === currentUserId;

    return (
      <Card
        className={isActive ? "cursor-pointer hover:bg-muted/50 transition-colors" : ""}
        onClick={isActive ? () => router.push(`/chat/${chatroom.chat_room_id}`) : undefined}
      >
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full border overflow-hidden bg-muted flex items-center justify-center shrink-0">
              {otherUser?.profile_picture ? (
                <img
                  src={otherUser.profile_picture}
                  alt={otherUser.first_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-lg text-muted-foreground">
                  {otherUser?.first_name?.[0]?.toUpperCase() ?? "?"}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
              <p className="font-semibold">
                {otherUser?.first_name} {otherUser?.last_name}
              </p>
              <span className="text-xs text-muted-foreground">@{otherUser?.username}</span>
            </div>

            {!isActive && (
              <div className="flex items-center gap-2 shrink-0">
                {isMine ? (
                  <span className="text-xs text-muted-foreground italic">Awaiting response...</span>
                ) : (
                  <>
                    <Button
                      size="sm"
                      disabled={pendingAction === chatroom.chat_room_id}
                      onClick={(e) => { e.stopPropagation(); handleAccept(chatroom.chat_room_id); }}
                    >
                      Accept
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pendingAction === chatroom.chat_room_id}
                      onClick={(e) => { e.stopPropagation(); handleDecline(chatroom.chat_room_id); }}
                    >
                      Decline
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-5xl mx-auto px-5 py-10">
        <div className="flex flex-col gap-2 mb-8">
          <h1 className="text-2xl font-bold">Messages</h1>
          <p className="text-sm text-muted-foreground">
            Your conversations with potential roommates
          </p>
        </div>

        {active.length === 0 && pending.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <p className="text-muted-foreground">
                No conversations yet. Start messaging from the Matching page!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-8">
            {active.length > 0 && (
              <div className="flex flex-col gap-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Active
                </p>
                {active.map((c) => (
                  <ConversationCard key={c.chat_room_id} chatroom={c} />
                ))}
              </div>
            )}
            {pending.length > 0 && (
              <div className="flex flex-col gap-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Pending
                </p>
                {pending.map((c) => (
                  <ConversationCard key={c.chat_room_id} chatroom={c} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
