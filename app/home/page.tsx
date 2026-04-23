"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Navbar } from "@/components/navbar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

type Roommate = {
  username: string;
  first_name: string;
  last_name: string;
};

type HousingInfo = {
  roomNumber: string;
  building: string;
  roommates: Roommate[];
};

export default function HomePage() {
  const router = useRouter();
  const [housing, setHousing] = useState<HousingInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getHousingInfo = async () => {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth/login");
        return;
      }

      const username = user.user_metadata?.username;
      const res = await fetch(`/api/getUserInfo?username=${username}`);
      const data = await res.json();

      if (!res.ok || !data.user.room_id) {
        setLoading(false);
        return;
      }

      const roomId = data.user.room_id;

      // Get room and building info
      const { data: roomData, error: roomError } = await supabase
        .from("rooms")
        .select("roomNumber, building_id, buildings(name)")
        .eq("id", roomId)
        .single();

      if (roomError || !roomData) {
        setLoading(false);
        return;
      }

      // Get roommates (other users with same room_id)
      const { data: roommatesData, error: roommatesError } = await supabase
        .from("users")
        .select("username, first_name, last_name")
        .eq("room_id", roomId)
        .neq("username", username);

      setHousing({
        roomNumber: roomData.roomNumber,
        building: (roomData.buildings as any)?.name ?? "Unknown",
        roommates: roommatesError ? [] : roommatesData ?? [],
      });

      setLoading(false);
    };

    getHousingInfo();
  }, [router]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-5xl mx-auto px-5 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Your Housing</CardTitle>
            <CardDescription>Your current room and building assignment</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : housing ? (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Building</p>
                    <p className="font-medium">{housing.building}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Room Number</p>
                    <p className="font-medium">{housing.roomNumber}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Roommates</p>
                  {housing.roommates.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {housing.roommates.map((roommate) => (
                        <div
                          key={roommate.username}
                          className="flex items-center gap-2 text-sm border rounded-md px-3 py-2"
                        >
                          <span className="font-medium">
                            {roommate.first_name} {roommate.last_name}
                          </span>
                          <span className="text-muted-foreground">
                            @{roommate.username}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No roommates assigned yet.</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                You have not been assigned a room yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}