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
  roomnumber: string;
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

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth/login");
        return;
      }

      const username = user.user_metadata?.username;

      // Get user info
      const userRes = await fetch(`/api/getUserInfo?username=${username}`);
      const userData = await userRes.json();

      if (!userRes.ok || !userData.user.room_id) {
        setLoading(false);
        return;
      }

      const roomId = userData.user.room_id;

      // Get room info via API route
      const roomRes = await fetch(`/api/getRoomInfo?room_id=${roomId}`);
      const roomData = await roomRes.json();

      if (!roomRes.ok || !roomData.room) {
        setLoading(false);
        return;
      }

      // Get building info via API route
      const buildingRes = await fetch(`/api/getBuildingInfo?building_id=${roomData.room.building_id}`);
      const buildingData = await buildingRes.json();

      // Get roommates (other users with same room_id)
      const { data: roommatesData, error: roommatesError } = await supabase
        .from("users")
        .select("username, first_name, last_name")
        .eq("room_id", roomId)
        .neq("username", username);

      setHousing({
        roomnumber: roomData.room.roomnumber,
        building: buildingData.building?.name ?? "Unknown",
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
                    <p className="font-medium">{housing.roomnumber}</p>
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