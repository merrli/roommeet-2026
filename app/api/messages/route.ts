import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chatRoomId = searchParams.get("chat_room_id");

  if (!chatRoomId) {
    return NextResponse.json({ error: "chat_room_id is required" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("messages")
    .select("message_id, sender_id, receiver_id, message_text, is_read, created_at")
    .eq("chat_room_id", chatRoomId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ messages: data });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { chat_room_id, sender_id, receiver_id, message_text } = body;

  if (!chat_room_id || !sender_id || !receiver_id || !message_text) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("messages")
    .insert([{ chat_room_id, sender_id, receiver_id, message_text }])
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: data }, { status: 201 });
}