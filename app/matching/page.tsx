"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Navbar } from "@/components/navbar";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Personables = {
  has_pets?: boolean;
  pets_ok?: boolean;
  smoking_ok?: boolean;
  bedtime?: string;
  waketime?: string;
  guest_tolerance?: number;
  noise_tolerance?: number;
};

type MatchUser = {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  bio: string;
  school_year: string;
  gender: string;
  profile_picture: string | null;
  personables: Personables | null;
  score: number;
};

type CurrentUser = {
  id: string;
  username: string;
  gender: string;
  room_id: number | null;
  genderinclusivehousing: boolean;
  personables: Personables | null;
};

function formatTime12h(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${period}`;
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function calculateScore(current: Personables, other: Personables): number {
  let score = 0;

  // Pets
  if (current.pets_ok !== undefined && other.pets_ok !== undefined) {
    if (current.pets_ok === other.pets_ok) score += 1;
  }

  // Smoking
  if (current.smoking_ok !== undefined && other.smoking_ok !== undefined) {
    if (current.smoking_ok === other.smoking_ok) score += 1;
  }

  // Guest tolerance
  if (current.guest_tolerance !== undefined && other.guest_tolerance !== undefined) {
    const diff = Math.abs(current.guest_tolerance - other.guest_tolerance);
    if (diff === 0) score += 2;
    else if (diff <= 1) score += 1;
  }

  // Noise tolerance
  if (current.noise_tolerance !== undefined && other.noise_tolerance !== undefined) {
    const diff = Math.abs(current.noise_tolerance - other.noise_tolerance);
    if (diff === 0) score += 2;
    else if (diff <= 1) score += 1;
  }

  // Bedtime
  if (current.bedtime && other.bedtime) {
    const diff = Math.abs(timeToMinutes(current.bedtime) - timeToMinutes(other.bedtime));
    if (diff === 0) score += 2;
    else if (diff <= 60) score += 1;
  }

  // Wake time
  if (current.waketime && other.waketime) {
    const diff = Math.abs(timeToMinutes(current.waketime) - timeToMinutes(other.waketime));
    if (diff === 0) score += 2;
    else if (diff <= 60) score += 1;
  }

  return score;
}

export default function MatchingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<MatchUser[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  async function handleReject(match: MatchUser) {
    if (!currentUser) return;
    setPendingAction(match.username);
    await fetch(`/api/rejectUsers?username=${currentUser.username}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rejected_user_id: match.id }),
    });
    setMatches((prev) => prev.filter((m) => m.username !== match.username));
    setPendingAction(null);
  }

  async function handleMessage(match: MatchUser) {
    if (!currentUser) return;
    setPendingAction(match.username);
    const res = await fetch("/api/chatroom", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_1: currentUser.id, user_2: match.id, created_by: currentUser.id }),
    });
    const data = await res.json();
    setPendingAction(null);
    if (res.ok && data.chatroom?.chat_room_id) {
      router.push(`/chat/${data.chatroom.chat_room_id}`);
    }
  }

  useEffect(() => {
    

    const loadMatches = async () => {
      const supabase = createClient();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth/login");
        return;
      }

      const username = user.user_metadata?.username;

      // Get current user info
      const res = await fetch(`/api/getUserInfo?username=${username}`);
      const data = await res.json();

      if (!res.ok) {
        setLoading(false);
        return;
      }

      const current: CurrentUser = data.user;
      setCurrentUser(current);

      // Get IDs of users who already have a chatroom with the current user
      const { data: chatroomsData } = await supabase
        .from("chatrooms")
        .select("user_1, user_2")
        .or(`user_1.eq.${current.id},user_2.eq.${current.id}`);

      const existingChatroomUserIds = new Set(
        (chatroomsData ?? []).flatMap((c) =>
          [c.user_1, c.user_2].filter((id) => id !== current.id)
        )
      );

      // Build query for other users
      let query = supabase
        .from("users")
        .select("id, username, first_name, last_name, bio, school_year, gender, profile_picture, personables, genderinclusivehousing, room_id")
        .neq("username", username);

      // Exclude users with the same room_id
        if (current.room_id) {
            query = query.or(`room_id.is.null,room_id.neq.${current.room_id}`);
        }
        const { data: usersData, error } = await query;

      const filteredUsers = (usersData ?? []).filter((u) => {
        if (existingChatroomUserIds.has(u.id)) return false;
        if (!current.genderinclusivehousing) {
        // Only show same gender or users who are open to inclusive housing
        if (!u.genderinclusivehousing && u.gender !== current.gender) {return false;}
        }
            return true;
      });

      // Calculate scores and filter
      const scored: MatchUser[] = filteredUsers
        .map((u) => {
        let score = 0;
        if (current.personables && u.personables) {
            score = calculateScore(current.personables, u.personables);
        }
        return { ...u, score };
    })
    .filter((u) => u.personables === null || u.score >= 6)
    .sort((a, b) => {
        if (!a.personables && b.personables) return 1;
        if (a.personables && !b.personables) return -1;
        return b.score - a.score;
    });

      setMatches(scored);
      setLoading(false);
    };

    loadMatches();
  }, [router]);

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
      <div className="max-w-5xl mx-auto px-5 py-10">
        <div className="flex flex-col gap-2 mb-8">
          <h1 className="text-2xl font-bold">Matching</h1>
          <p className="text-sm text-muted-foreground">
            Potential roommates ranked by compatibility with your preferences
          </p>
        </div>

        {matches.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <p className="text-muted-foreground">No matches found yet. Make sure your preferences are filled out!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {matches.map((match) => (
              <Card key={match.username} className={match.score === 10 ? "border-primary" : ""}>
                <CardContent className="py-4">
                  <div className="flex items-start gap-4">

                    {/* Profile Picture */}
                    <div className="w-16 h-16 rounded-full border overflow-hidden bg-muted flex items-center justify-center shrink-0">
                      {match.profile_picture ? (
                        <img
                          src={match.profile_picture}
                          alt={match.first_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xl text-muted-foreground">
                          {match.first_name?.[0]?.toUpperCase() ?? "?"}
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex flex-col gap-1 flex-1">
                      {match.score === 10 && (
                        <p className="text-xs font-semibold text-primary">
                          ✨ We think {match.first_name} is a perfect fit for you!
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">
                          {match.first_name} {match.last_name}
                        </p>
                        <span className="text-xs text-muted-foreground">@{match.username}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {match.school_year && <span>{match.school_year}</span>}
                        {match.gender && <span>· {match.gender}</span>}
                      </div>
                      {match.bio && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{match.bio}</p>
                      )}
                      {match.personables && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {match.personables.has_pets !== undefined && (
                            <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                              {match.personables.has_pets ? "Has pets" : "No pets"}
                            </span>
                          )}
                          {match.personables.pets_ok !== undefined && (
                            <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                              {match.personables.pets_ok ? "Pets OK" : "No pets in room"}
                            </span>
                          )}
                          {match.personables.smoking_ok !== undefined && (
                            <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                              {match.personables.smoking_ok ? "Smoking OK" : "No smoking"}
                            </span>
                          )}
                          {match.personables.bedtime && (
                            <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                              Bedtime {formatTime12h(match.personables.bedtime)}
                            </span>
                          )}
                          {match.personables.waketime && (
                            <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                              Wake {formatTime12h(match.personables.waketime)}
                            </span>
                          )}
                          {match.personables.guest_tolerance !== undefined && (
                            <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                              Guests {match.personables.guest_tolerance}/5
                            </span>
                          )}
                          {match.personables.noise_tolerance !== undefined && (
                            <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                              Noise {match.personables.noise_tolerance}/5
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pendingAction === match.username}
                        onClick={() => handleReject(match)}
                      >
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        disabled={pendingAction === match.username}
                        onClick={() => handleMessage(match)}
                      >
                        Message
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}