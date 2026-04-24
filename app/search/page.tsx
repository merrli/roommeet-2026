"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Navbar } from "@/components/navbar";
import { MessageCircle } from "lucide-react";

type UserResult = {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  room_id: string | null;
  rooms: {
    roomnumber: string;
    buildings: { name: string } | null;
  } | null;
};

function SearchResults() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get("q") ?? "";

  const [results, setResults] = useState<UserResult[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState(query);
  const [messagingUserId, setMessagingUserId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const res = await fetch(`/api/getUserInfo?username=${user.user_metadata?.username}`);
      if (res.ok) {
        const data = await res.json();
        setIsAdmin(data.user.role === "admin");
        setCurrentUserId(data.user.id);
      }
    };
    init();
  }, []);

  useEffect(() => {
    setSearchInput(query);
    if (!query || query.trim().length < 2) {
      setResults([]);
      return;
    }

    const fetchResults = async () => {
      setLoading(true);
      const res = await fetch(`/api/searchUsers?query=${encodeURIComponent(query.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.users ?? []);
      }
      setLoading(false);
    };

    fetchResults();
  }, [query]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    router.push(`/search?q=${encodeURIComponent(searchInput.trim())}`);
  };

  const handleMessage = async (targetUserId: string) => {
    if (!currentUserId || messagingUserId) return;
    setMessagingUserId(targetUserId);

    const res = await fetch("/api/chatroom", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_1: currentUserId,
        user_2: targetUserId,
        created_by: currentUserId,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      router.push(`/chat/${data.chatroom.chat_room_id}`);
    } else {
      setMessagingUserId(null);
    }
  };

  return (
    <main className="min-h-screen flex flex-col">
      <Navbar />
      <div className="max-w-5xl w-full mx-auto px-5 py-10">
        <form onSubmit={handleSubmit} className="flex gap-2 mb-8">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name or username..."
            className="flex-1 px-4 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            type="submit"
            className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Search
          </button>
        </form>

        {query && (
          <p className="text-sm text-muted-foreground mb-4">
            {loading
              ? "Searching..."
              : `${results.length} result${results.length !== 1 ? "s" : ""} for "${query}"`}
          </p>
        )}

        {!loading && results.length === 0 && query.trim().length >= 2 && (
          <p className="text-sm text-muted-foreground">No users found.</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {results.map((user) => (
            <div
              key={user.id}
              className="border border-border rounded-lg p-4 flex flex-col gap-1 bg-background"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <p className="font-semibold text-sm">
                    {user.first_name} {user.last_name}
                  </p>
                  <p className="text-xs text-muted-foreground">@{user.username}</p>
                </div>

                {currentUserId && user.id !== currentUserId && (
                  <button
                    onClick={() => handleMessage(user.id)}
                    disabled={messagingUserId === user.id}
                    title="Send message"
                    className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </button>
                )}
              </div>

              {isAdmin && (
                <div className="mt-2 pt-2 border-t border-border">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Housing
                  </p>
                  {user.rooms ? (
                    <p className="text-sm">
                      {user.rooms.buildings?.name ?? "Unknown Building"} — Room {user.rooms.roomnumber}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">No room assigned</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchResults />
    </Suspense>
  );
}
