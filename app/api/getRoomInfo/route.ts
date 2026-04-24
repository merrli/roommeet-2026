import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get("room_id");
  const all = searchParams.get("all");

  const supabase = await createClient();

  // Return all rooms with building info
  if (all === "true") {
    const { data, error } = await supabase
      .from("rooms")
      .select("id, roomnumber, property, building_id, buildings(name)");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ rooms: data });
  }

  // Return single room by id
  if (!roomId) {
    return NextResponse.json({ error: "room_id or all=true is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("rooms")
    .select("id, roomnumber, property, building_id, buildings(name)")
    .eq("id", roomId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  return NextResponse.json({ room: data });
}