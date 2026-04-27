import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("user_id");
  const all = searchParams.get("all");

  const supabase = await createClient();

  if (all === "true") {
    const { data, error } = await supabase
      .from("change_requests")
      .select(`
        id, message, status, created_at,
        requester:users!user_id(first_name, last_name, username),
        current_room:rooms!current_room_id(roomnumber, buildings(name)),
        target_room:rooms!target_room_id(roomnumber, buildings(name))
      `)
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ requests: data });
  }

  if (!userId) {
    return NextResponse.json({ error: "user_id or all=true is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("change_requests")
    .select("id, current_room_id, target_room_id, message, status, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ requests: data });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { user_id, current_room_id, target_room_id, message } = body;

  if (!user_id || !target_room_id) {
    return NextResponse.json({ error: "user_id and target_room_id are required" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("change_requests")
    .select("id")
    .eq("user_id", user_id)
    .eq("target_room_id", target_room_id)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "You already have a pending request for this room" }, { status: 409 });
  }

  const { data, error } = await supabase
    .from("change_requests")
    .insert({ user_id, current_room_id , target_room_id, message: message || null, status: "pending" })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from("users").update({ change_request: true }).eq("id", user_id);

  return NextResponse.json({ request: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const { id, status } = body;

  if (!id || !["approved", "rejected"].includes(status)) {
    return NextResponse.json({ error: "id and valid status are required" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: changeRequest, error: fetchError } = await supabase
    .from("change_requests")
    .select("id, user_id, target_room_id")
    .eq("id", id)
    .single();

  if (fetchError || !changeRequest) {
    return NextResponse.json({ error: fetchError?.message ?? "Request not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("change_requests")
    .update({ status })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (status === "approved") {
    const { error: userError } = await supabase
      .from("users")
      .update({ room_id: changeRequest.target_room_id })
      .eq("id", changeRequest.user_id);

    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ request: data });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("change_requests")
    .delete()
    .eq("id", id)
    .eq("status", "pending");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
