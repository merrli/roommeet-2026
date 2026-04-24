import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json();
  const { user_1, user_2, created_by } = body;

  if (!user_1 || !user_2 || !created_by) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = await createClient();

  // Check if chatroom already exists between these two users
  const { data: existing } = await supabase
    .from("chatrooms")
    .select("chat_room_id, status")
    .or(
      `and(user_1.eq.${user_1},user_2.eq.${user_2}),and(user_1.eq.${user_2},user_2.eq.${user_1})`
    )
    .single();

  if (existing) {
    return NextResponse.json({ chatroom: existing }, { status: 200 });
  }

  // Create new chatroom with pending status
  const { data, error } = await supabase
    .from("chatrooms")
    .insert([{ user_1, user_2, created_by, status: "pending" }])
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ chatroom: data }, { status: 201 });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("user_id");

  if (!userId) {
    return NextResponse.json({ error: "user_id is required" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("chatrooms")
    .select(`
      chat_room_id,
      status,
      created_by,
      user_1,
      user_2
    `)
    .or(`user_1.eq.${userId},user_2.eq.${userId}`)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ chatrooms: data });
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const { chat_room_id, status } = body;

  if (!chat_room_id || !status) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = await createClient();

  if (status === "declined") {
    const { error } = await supabase
      .from("chatrooms")
      .delete()
      .eq("chat_room_id", chat_room_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  const { error } = await supabase
    .from("chatrooms")
    .update({ status })
    .eq("chat_room_id", chat_room_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}