import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username");
  const changeRequests = searchParams.get("change_requests");

  const supabase = await createClient();

  if (changeRequests === "true") {
    const { data, error } = await supabase
      .from("users")
      .select("id, username, first_name, last_name, room_id, rooms(roomnumber, buildings(name))")
      .eq("change_request", true);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ users: data });
  }

  if (!username) {
    return NextResponse.json({ error: "Username is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("users")
    .select("id, username, first_name, last_name, email, role, school_year, gender, bio, petaccommodation, genderinclusivehousing, room_id, personables")
    .eq("username", username)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ user: data });
}