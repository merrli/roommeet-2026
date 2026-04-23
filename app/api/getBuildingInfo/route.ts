import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const buildingId = searchParams.get("building_id");
  const all = searchParams.get("all");

  const supabase = await createClient();

  // Return all buildings
  if (all === "true") {
    const { data, error } = await supabase
      .from("buildings")
      .select("id, name");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ buildings: data });
  }

  // Return single building by id
  if (!buildingId) {
    return NextResponse.json({ error: "building_id or all=true is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("buildings")
    .select("id, name")
    .eq("id", buildingId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Building not found" }, { status: 404 });
  }

  return NextResponse.json({ building: data });
}