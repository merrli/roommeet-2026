"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

type Room = {
  id: number;
  roomnumber: string;
  building_id: number;
  buildings: any;
};

type Building = {
  id: number;
  name: string;
};

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [username, setUsername] = useState("");
  const [selectedBuilding, setSelectedBuilding] = useState("");
  const [selectedRoom, setSelectedRoom] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const filteredRooms = rooms.filter(
    (room) => room.building_id === parseInt(selectedBuilding)
  );

  useEffect(() => {
    const checkAdmin = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth/login");
        return;
      }

      const uname = user.user_metadata?.username;
      const res = await fetch(`/api/getUserInfo?username=${uname}`);
      const data = await res.json();

      if (!res.ok || data.user.role !== "admin") {
        router.push("/home");
        return;
      }

      // Fetch all rooms and buildings via API routes
      const [roomsRes, buildingsRes] = await Promise.all([
        fetch("/api/getRoomInfo?all=true"),
        fetch("/api/getBuildingInfo?all=true"),
      ]);

      const roomsData = await roomsRes.json();
      const buildingsData = await buildingsRes.json();

      if (roomsRes.ok && roomsData.rooms) setRooms(roomsData.rooms);
      if (buildingsRes.ok && buildingsData.buildings) setBuildings(buildingsData.buildings);

      setLoading(false);
    };

    checkAdmin();
  }, [router]);

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    const res = await fetch(`/api/updateUser?username=${username}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room_id: parseInt(selectedRoom) }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to assign room");
    } else {
      const room = rooms.find((r) => r.id === parseInt(selectedRoom));
      const building = buildings.find((b) => b.id === parseInt(selectedBuilding));
      setMessage(`Successfully assigned ${username} to ${building?.name} — Room ${room?.roomnumber}`);
      setUsername("");
      setSelectedBuilding("");
      setSelectedRoom("");
    }

    setSaving(false);
  };

  const handleRemove = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    const res = await fetch(`/api/updateUser?username=${username}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room_id: null }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to remove user from room");
    } else {
      setMessage(`Successfully removed ${username} from their room`);
      setUsername("");
    }

    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-5xl mx-auto px-5 py-10 flex flex-col gap-6">
        <h1 className="text-2xl font-bold">Admin Panel</h1>

        {message && <p className="text-sm text-green-500">{message}</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}

        {/* Assign Room */}
        <Card>
          <CardHeader>
            <CardTitle>Assign User to Room</CardTitle>
            <CardDescription>Select a building and room to assign a user to</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAssign}>
              <div className="flex flex-col gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Enter username"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="building">Building</Label>
                  <select
                    id="building"
                    required
                    value={selectedBuilding}
                    onChange={(e) => {
                      setSelectedBuilding(e.target.value);
                      setSelectedRoom("");
                    }}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                  >
                    <option value="" disabled>Select a building</option>
                    {buildings.map((building) => (
                      <option key={building.id} value={building.id}>
                        {building.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="room">Room</Label>
                  <select
                    id="room"
                    required
                    value={selectedRoom}
                    onChange={(e) => setSelectedRoom(e.target.value)}
                    disabled={!selectedBuilding}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                  >
                    <option value="" disabled>
                      {selectedBuilding ? "Select a room" : "Select a building first"}
                    </option>
                    {filteredRooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        Room {room.roomnumber}
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="submit" className="w-full" disabled={saving}>
                  {saving ? "Assigning..." : "Assign Room"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Remove from Room */}
        <Card>
          <CardHeader>
            <CardTitle>Remove User from Room</CardTitle>
            <CardDescription>Remove a user's current room assignment</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRemove}>
              <div className="flex flex-col gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="remove-username">Username</Label>
                  <Input
                    id="remove-username"
                    type="text"
                    placeholder="Enter username"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
                <Button type="submit" variant="destructive" className="w-full" disabled={saving}>
                  {saving ? "Removing..." : "Remove from Room"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}