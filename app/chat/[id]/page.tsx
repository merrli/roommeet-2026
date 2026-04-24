"use client";

export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

type Message = {
  message_id: string;
  sender_id: string;
  receiver_id: string;
  message_text: string;
  is_read: boolean;
  created_at: string;
};

type OtherUser = {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  profile_picture: string | null;
};

type Chatroom = {
  chat_room_id: string;
  status: string;
  created_by: string;
  user_1: string;
  user_2: string;
};

export default function ChatPage() {
  const router = useRouter();
  const params = useParams();
  const chatRoomId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [chatroom, setChatroom] = useState<Chatroom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
      if (!res.ok) { router.push("/chatrooms"); return; }

      const currentId: string = data.user.id;
      setCurrentUserId(currentId);

      const { data: roomData, error: roomError } = await supabase
        .from("chatrooms")
        .select("chat_room_id, status, created_by, user_1, user_2")
        .eq("chat_room_id", chatRoomId)
        .single();

      if (roomError || !roomData) {
        router.push("/chatrooms");
        return;
      }

      if (roomData.user_1 !== currentId && roomData.user_2 !== currentId) {
        router.push("/chatrooms");
        return;
      }

      setChatroom(roomData);

      const otherId = roomData.user_1 === currentId ? roomData.user_2 : roomData.user_1;
      const { data: otherUserData } = await supabase
        .from("users")
        .select("id, username, first_name, last_name, profile_picture")
        .eq("id", otherId)
        .single();

      setOtherUser(otherUserData ?? null);

      const msgRes = await fetch(`/api/messages?chat_room_id=${chatRoomId}`);
      const msgData = await msgRes.json();
      setMessages(msgData.messages ?? []);

      setLoading(false);
    };

    load();
  }, [router, chatRoomId]);

  // Poll for new messages every 3 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await fetch(`/api/messages?chat_room_id=${chatRoomId}`);
      const data = await res.json();
      if (res.ok) setMessages(data.messages ?? []);
    }, 3000);
    return () => clearInterval(interval);
  }, [chatRoomId]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !currentUserId || !otherUser) return;
    setSending(true);
    await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_room_id: chatRoomId,
        sender_id: currentUserId,
        receiver_id: otherUser.id,
        message_text: messageText.trim(),
      }),
    });
    setMessageText("");
    const res = await fetch(`/api/messages?chat_room_id=${chatRoomId}`);
    const data = await res.json();
    if (res.ok) setMessages(data.messages ?? []);
    setSending(false);
  };

  const formatTime = (timestamp: string) =>
    new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const isPending = chatroom?.status === "pending";
  const iMadeRequest = chatroom?.created_by === currentUserId;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <div className="max-w-3xl w-full mx-auto px-5 py-8 flex flex-col gap-4" style={{ height: "calc(100vh - 64px)" }}>

        {/* Header */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => router.push("/chatrooms")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors mr-1"
          >
            ← Back
          </button>
          <div className="w-10 h-10 rounded-full border overflow-hidden bg-muted flex items-center justify-center shrink-0">
            {otherUser?.profile_picture ? (
              <img
                src={otherUser.profile_picture}
                alt={otherUser.first_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-sm text-muted-foreground">
                {otherUser?.first_name?.[0]?.toUpperCase() ?? "?"}
              </span>
            )}
          </div>
          <div>
            <p className="font-semibold leading-tight">
              {otherUser?.first_name} {otherUser?.last_name}
            </p>
            <span className="text-xs text-muted-foreground">@{otherUser?.username}</span>
          </div>
        </div>

        {isPending ? (
          <Card className="flex-1 flex items-center justify-center">
            <CardContent className="py-10 text-center">
              <p className="text-muted-foreground">
                {iMadeRequest
                  ? "Waiting for them to accept your message request."
                  : "You have a pending message request from this user. Accept it from the Messages page to start chatting."}
              </p>
              <button
                onClick={() => router.push("/chatrooms")}
                className="text-sm text-primary hover:underline mt-3 block mx-auto"
              >
                Go to Messages
              </button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Messages area */}
            <div className="flex-1 overflow-y-auto border rounded-lg p-4 bg-muted/20 flex flex-col gap-2 min-h-0">
              {messages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center m-auto">
                  No messages yet. Say hi!
                </p>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.sender_id === currentUserId;
                  return (
                    <div
                      key={msg.message_id}
                      className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm ${
                          isMe
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-muted text-foreground rounded-bl-sm"
                        }`}
                      >
                        <p>{msg.message_text}</p>
                        <p
                          className={`text-[10px] mt-0.5 ${
                            isMe ? "text-primary-foreground/70" : "text-muted-foreground"
                          }`}
                        >
                          {formatTime(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="flex gap-2 shrink-0">
              <Input
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Type a message..."
                disabled={sending}
                className="flex-1"
              />
              <Button type="submit" disabled={sending || !messageText.trim()}>
                Send
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
