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
  buildings: { name: string };
};

type Building = {
  id: number;
  name: string;
};

type SwapRequest = {
  id: string;
  message: string | null;
  status: string;
  created_at: string;
  requester: { first_name: string; last_name: string; username: string } | null;
  current_room: { roomnumber: string; buildings: { name: string } | null } | null;
  target_room: { roomnumber: string; buildings: { name: string } | null } | null;
};

type ChangeRequestUser = {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  room_id: string | null;
  rooms: { roomnumber: string; buildings: { name: string } | null } | null;
};

type Section = "assign" | "remove" | "swap-requests";

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
  const [activeSection, setActiveSection] = useState<Section>("assign");
  const [swapRequests, setSwapRequests] = useState<SwapRequest[]>([]);
  const [changeRequestUsers, setChangeRequestUsers] = useState<ChangeRequestUser[]>([]);
  const [loadingSwap, setLoadingSwap] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [unresolvedCount, setUnresolvedCount] = useState(0);

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

      const [roomsRes, buildingsRes] = await Promise.all([
        fetch("/api/getRoomInfo?all=true"),
        fetch("/api/getBuildingInfo?all=true"),
      ]);

      const roomsData = await roomsRes.json();
      const buildingsData = await buildingsRes.json();

      if (roomsRes.ok && roomsData.rooms) setRooms(roomsData.rooms);
      if (buildingsRes.ok && buildingsData.buildings) setBuildings(buildingsData.buildings);

      // Load unresolved count for badge
      const [swapRes, crRes] = await Promise.all([
        fetch("/api/roomSwapRequest?all=true"),
        fetch("/api/getUserInfo?change_requests=true"),
      ]);
      const swapData = await swapRes.json();
      const crData = await crRes.json();
      setUnresolvedCount((swapData.requests?.length ?? 0) + (crData.users?.length ?? 0));

      setLoading(false);
    };

    checkAdmin();
  }, [router]);

  const loadSwapRequests = async () => {
    setLoadingSwap(true);
    const [swapRes, crRes] = await Promise.all([
      fetch("/api/roomSwapRequest?all=true"),
      fetch("/api/getUserInfo?change_requests=true"),
    ]);
    const swapData = await swapRes.json();
    const crData = await crRes.json();
    setSwapRequests(swapData.requests ?? []);
    setChangeRequestUsers(crData.users ?? []);
    setLoadingSwap(false);
  };

  const handleResolve = async (id: string, status: "approved" | "rejected") => {
    setResolvingId(id);
    const res = await fetch("/api/roomSwapRequest", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) {
      setSwapRequests((prev) => {
        const updated = prev.filter((r) => r.id !== id);
        setUnresolvedCount((c) => Math.max(0, c - 1));
        return updated;
      });
    }
    setResolvingId(null);
  };

  const handleDismissChangeRequest = async (username: string, userId: string) => {
    setDismissingId(userId);
    const res = await fetch(`/api/updateUser?username=${username}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ change_request: false }),
    });
    if (res.ok) {
      setChangeRequestUsers((prev) => {
        const updated = prev.filter((u) => u.id !== userId);
        setUnresolvedCount((c) => Math.max(0, c - 1));
        return updated;
      });
    }
    setDismissingId(null);
  };

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

  const switchSection = (section: Section) => {
    setActiveSection(section);
    setMessage(null);
    setError(null);
    if (section === "swap-requests") loadSwapRequests();
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
      <div className="max-w-5xl mx-auto px-5 py-10 flex gap-8">

        {/* Sidebar */}
        <div className="w-48 flex flex-col gap-2 shrink-0">
          <p className="text-xs text-muted-foreground font-semibold uppercase mb-1">Admin</p>
          <button
            onClick={() => switchSection("assign")}
            className={`text-left text-sm px-3 py-2 rounded-md transition-colors ${
              activeSection === "assign" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
          >
            Assign Room
          </button>
          <button
            onClick={() => switchSection("remove")}
            className={`text-left text-sm px-3 py-2 rounded-md transition-colors ${
              activeSection === "remove" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
          >
            Remove from Room
          </button>
          <button
            onClick={() => switchSection("swap-requests")}
            className={`text-left text-sm px-3 py-2 rounded-md transition-colors flex items-center justify-between gap-2 ${
              activeSection === "swap-requests" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
          >
            Room Swap Requests
            {unresolvedCount > 0 && (
              <span className={`text-[10px] font-bold rounded-full min-w-4 h-4 flex items-center justify-center px-1 ${
                activeSection === "swap-requests" ? "bg-primary-foreground text-primary" : "bg-red-500 text-white"
              }`}>
                {unresolvedCount > 99 ? "99+" : unresolvedCount}
              </span>
            )}
          </button>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          {message && <p className="text-sm text-green-500 mb-4">{message}</p>}
          {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

          {/* Assign Room */}
          {activeSection === "assign" && (
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
          )}

          {/* Remove from Room */}
          {activeSection === "remove" && (
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
          )}

          {/* Room Swap Requests */}
          {activeSection === "swap-requests" && (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-1">
                <h2 className="text-xl font-bold">Room Swap Requests</h2>
                <p className="text-sm text-muted-foreground">
                  Pending swap requests and users flagged for a room change.
                </p>
              </div>

              {loadingSwap ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : (
                <>
                  {/* Change request users */}
                  {changeRequestUsers.length > 0 && (
                    <div className="flex flex-col gap-3">
                      <p className="text-sm font-semibold">Flagged for Room Change</p>
                      {changeRequestUsers.map((u) => (
                        <Card key={u.id}>
                          <CardContent className="py-4 flex items-start justify-between gap-4">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold">{u.first_name} {u.last_name}</p>
                                <span className="text-xs text-muted-foreground">@{u.username}</span>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                <span className="font-medium text-foreground">Current room:</span>{" "}
                                {u.rooms
                                  ? `${u.rooms.buildings?.name ?? "Unknown"} — Room ${u.rooms.roomnumber}`
                                  : "Unassigned"}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={dismissingId === u.id}
                              onClick={() => handleDismissChangeRequest(u.username, u.id)}
                            >
                              {dismissingId === u.id ? "Dismissing..." : "Dismiss"}
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  {/* Swap requests */}
                  <div className="flex flex-col gap-3">
                    <p className="text-sm font-semibold">Swap Requests</p>
                    {swapRequests.length === 0 ? (
                      <Card>
                        <CardContent className="py-8 text-center">
                          <p className="text-muted-foreground text-sm">No pending swap requests.</p>
                        </CardContent>
                      </Card>
                    ) : (
                      swapRequests.map((req) => (
                        <Card key={req.id}>
                          <CardContent className="py-4 flex items-start justify-between gap-4">
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold">
                                  {req.requester?.first_name} {req.requester?.last_name}
                                </p>
                                <span className="text-xs text-muted-foreground">@{req.requester?.username}</span>
                              </div>
                              <div className="text-sm text-muted-foreground flex flex-col gap-0.5">
                                <span>
                                  <span className="font-medium text-foreground">From:</span>{" "}
                                  {req.current_room
                                    ? `${req.current_room.buildings?.name ?? "Unknown"} — Room ${req.current_room.roomnumber}`
                                    : "Unassigned"}
                                </span>
                                <span>
                                  <span className="font-medium text-foreground">To:</span>{" "}
                                  {req.target_room
                                    ? `${req.target_room.buildings?.name ?? "Unknown"} — Room ${req.target_room.roomnumber}`
                                    : "Unknown"}
                                </span>
                              </div>
                              {req.message && (
                                <p className="text-xs text-muted-foreground italic">&ldquo;{req.message}&rdquo;</p>
                              )}
                              <p className="text-xs text-muted-foreground">
                                {new Date(req.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex gap-2 shrink-0 mt-1">
                              <Button
                                size="sm"
                                disabled={resolvingId === req.id}
                                onClick={() => handleResolve(req.id, "approved")}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={resolvingId === req.id}
                                onClick={() => handleResolve(req.id, "rejected")}
                              >
                                Reject
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>

                  {changeRequestUsers.length === 0 && swapRequests.length === 0 && (
                    <Card>
                      <CardContent className="py-10 text-center">
                        <p className="text-muted-foreground text-sm">No pending requests.</p>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
