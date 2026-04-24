import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PATCH(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username");

  if (!username) {
    return NextResponse.json({ error: "Username is required" }, { status: 400 });
  }

  const body = await request.json();
  const { school_year, gender, bio, room_id, first_name, last_name, profile_picture, personables, change_request } = body;

  // Build update object with only provided fields
  const updates: Record<string, any> = {};
  if (school_year !== undefined) updates.school_year = school_year;
  if (gender !== undefined) updates.gender = gender;
  if (bio !== undefined) updates.bio = bio;
  if (room_id !== undefined) updates.room_id = room_id;
  if (first_name !== undefined) updates.first_name = first_name;
  if (last_name !== undefined) updates.last_name = last_name;
  if (profile_picture !== undefined) updates.profile_picture = profile_picture;
  if (personables !== undefined) updates.personables = personables;
  if (change_request !== undefined) updates.change_request = change_request;

  const supabase = await createClient();

  const { error } = await supabase
    .from("users")
    .update(updates)
    .eq("username", username);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}