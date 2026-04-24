import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PATCH(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username");

  if (!username) {
    return NextResponse.json({ error: "Username is required" }, { status: 400 });
  }

  const body = await request.json();
  const { rejected_user_id } = body;

  if (!rejected_user_id) {
    return NextResponse.json({ error: "rejected_user_id is required" }, { status: 400 });
  }

  const supabase = await createClient();

  // Get current rejected_users array
  const { data: userData, error: fetchError } = await supabase
    .from("users")
    .select("rejected_users")
    .eq("username", username)
    .single();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const currentRejected = userData.rejected_users ?? [];

  // Add new rejected user if not already there
  if (!currentRejected.includes(rejected_user_id)) {
    currentRejected.push(rejected_user_id);
  }

  const { error: updateError } = await supabase
    .from("users")
    .update({ rejected_users: currentRejected })
    .eq("username", username);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username");

  if (!username) {
    return NextResponse.json({ error: "Username is required" }, { status: 400 });
  }

  const body = await request.json();
  const { rejected_user_id } = body;

  if (!rejected_user_id) {
    return NextResponse.json({ error: "rejected_user_id is required" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: userData, error: fetchError } = await supabase
    .from("users")
    .select("rejected_users")
    .eq("username", username)
    .single();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const updated = (userData.rejected_users ?? []).filter(
    (id: number) => id !== rejected_user_id
  );

  const { error: updateError } = await supabase
    .from("users")
    .update({ rejected_users: updated })
    .eq("username", username);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}