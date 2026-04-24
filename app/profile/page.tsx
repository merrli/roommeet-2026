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

type UserProfile = {
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  school_year: string;
  gender: string;
  bio: string;
  profile_picture: string | null;
  personables: {
    has_pets?: boolean;
    pets_ok?: boolean;
    smoking_ok?: boolean;
    bedtime?: string;
    waketime?: string;
    guest_tolerance?: number;
    noise_tolerance?: number;
  } | null;
};

type Section = "profile" | "personables" | "password" | "rejected";

type RejectedUser = {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  bio: string;
  school_year: string;
  gender: string;
  profile_picture: string | null;
};

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<Section>("profile");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [username, setUsername] = useState("");
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    school_year: "",
    gender: "",
    bio: "",
  });
  const [personables, setPersonables] = useState({
    has_pets: false,
    pets_ok: false,
    smoking_ok: false,
    bedtime: "23:00",
    waketime: "07:00",
    guest_tolerance: 3,
    noise_tolerance: 3,
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [rejectedUsers, setRejectedUsers] = useState<RejectedUser[]>([]);
  const [loadingRejected, setLoadingRejected] = useState(false);
  const [pendingUnreject, setPendingUnreject] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth/login");
        return;
      }

      const uname = user.user_metadata?.username;
      setUsername(uname);

      const res = await fetch(`/api/getUserInfo?username=${uname}`);
      const data = await res.json();

      if (res.ok) {
        setProfile(data.user);
        setForm({
          first_name: data.user.first_name || "",
          last_name: data.user.last_name || "",
          school_year: data.user.school_year || "",
          gender: data.user.gender || "",
          bio: data.user.bio || "",
        });
        if (data.user.profile_picture) {
          setAvatarPreview(data.user.profile_picture);
        }
        if (data.user.personables) {
          setPersonables({ ...personables, ...data.user.personables });
        }
      }

      setLoading(false);
    };

    loadProfile();
  }, [router]);

  const loadRejectedUsers = async () => {
    setLoadingRejected(true);
    const supabase = createClient();
    const { data: userData } = await supabase
      .from("users")
      .select("rejected_users")
      .eq("username", username)
      .single();

    const rejectedIds: string[] = userData?.rejected_users ?? [];
    if (rejectedIds.length > 0) {
      const { data } = await supabase
        .from("users")
        .select("id, username, first_name, last_name, bio, school_year, gender, profile_picture")
        .in("id", rejectedIds);
      setRejectedUsers(data ?? []);
    } else {
      setRejectedUsers([]);
    }
    setLoadingRejected(false);
  };

  const handleUnreject = async (user: RejectedUser) => {
    setPendingUnreject(user.username);
    await fetch(`/api/rejectUsers?username=${username}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rejected_user_id: user.id }),
    });
    setRejectedUsers((prev) => prev.filter((u) => u.username !== user.username));
    setPendingUnreject(null);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const supabase = createClient();
      let profilePictureUrl = profile?.profile_picture || null;

      if (avatarFile) {
        const fileExt = avatarFile.name.split(".").pop();
        const filePath = `${username}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("pfps")
          .upload(filePath, avatarFile, { upsert: true });

        if (uploadError) throw new Error(uploadError.message);

        const { data: urlData } = supabase.storage
          .from("pfps")
          .getPublicUrl(filePath);

        profilePictureUrl = urlData.publicUrl;
      }

      const res = await fetch(`/api/updateUser?username=${username}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, profile_picture: profilePictureUrl }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save profile");
      }

      setMessage("Profile updated successfully!");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handlePersonablesSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch(`/api/updateUser?username=${username}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personables }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save preferences");
      }

      setMessage("Preferences updated successfully!");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError("New passwords do not match");
      setSaving(false);
      return;
    }

    try {
      const supabase = createClient();

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile!.email,
        password: passwordForm.currentPassword,
      });

      if (signInError) throw new Error("Current password is incorrect");

      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordForm.newPassword,
      });

      if (updateError) throw new Error(updateError.message);

      setMessage("Password updated successfully!");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSaving(false);
    }
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

        {/* Left Menu */}
        <div className="w-48 flex flex-col gap-2 shrink-0">
          <p className="text-xs text-muted-foreground font-semibold uppercase mb-1">Account</p>
          <button
            onClick={() => { setActiveSection("profile"); setMessage(null); setError(null); }}
            className={`text-left text-sm px-3 py-2 rounded-md transition-colors ${
              activeSection === "profile" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
          >
            Edit Profile
          </button>
          <button
            onClick={() => { setActiveSection("personables"); setMessage(null); setError(null); }}
            className={`text-left text-sm px-3 py-2 rounded-md transition-colors ${
              activeSection === "personables" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
          >
            Preferences
          </button>
          <button
            onClick={() => { setActiveSection("password"); setMessage(null); setError(null); }}
            className={`text-left text-sm px-3 py-2 rounded-md transition-colors ${
              activeSection === "password" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
          >
            Change Password
          </button>
          <button
            onClick={() => { setActiveSection("rejected"); setMessage(null); setError(null); loadRejectedUsers(); }}
            className={`text-left text-sm px-3 py-2 rounded-md transition-colors ${
              activeSection === "rejected" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
          >
            Rejected Users
          </button>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          {message && <p className="text-sm text-green-500 mb-4">{message}</p>}
          {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

          {/* Edit Profile Section */}
          {activeSection === "profile" && (
            <Card>
              <CardHeader>
                <CardTitle>Edit Profile</CardTitle>
                <CardDescription>Update your personal information and profile picture</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleProfileSave}>
                  <div className="flex flex-col gap-6">
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 rounded-full border overflow-hidden bg-muted flex items-center justify-center shrink-0">
                        {avatarPreview ? (
                          <img src={avatarPreview} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-2xl text-muted-foreground">
                            {form.first_name?.[0]?.toUpperCase() ?? "?"}
                          </span>
                        )}
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="avatar">Profile Picture</Label>
                        <Input id="avatar" type="file" accept="image/*" onChange={handleAvatarChange} />
                        <p className="text-xs text-muted-foreground">Max 5MB. JPG, PNG, GIF, or WEBP.</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="first_name">First Name</Label>
                        <Input
                          id="first_name"
                          type="text"
                          value={form.first_name}
                          onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                          required
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="last_name">Last Name</Label>
                        <Input
                          id="last_name"
                          type="text"
                          value={form.last_name}
                          onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="school_year">School Year</Label>
                      <select
                        id="school_year"
                        value={form.school_year}
                        onChange={(e) => setForm({ ...form, school_year: e.target.value })}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                      >
                        <option value="" disabled>Select your school year</option>
                        <option value="Freshman">Freshman</option>
                        <option value="Sophomore">Sophomore</option>
                        <option value="Junior">Junior</option>
                        <option value="Senior">Senior</option>
                        <option value="Graduate">Graduate</option>
                      </select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="gender">Gender</Label>
                      <select
                        id="gender"
                        value={form.gender}
                        onChange={(e) => setForm({ ...form, gender: e.target.value })}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                      >
                        <option value="" disabled>Select your gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Nonbinary">Nonbinary</option>
                        <option value="Prefer to not say">Prefer to not say</option>
                    </select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="bio">Bio</Label>
                      <textarea
                        id="bio"
                        placeholder="Tell us a bit about yourself..."
                        value={form.bio}
                        onChange={(e) => setForm({ ...form, bio: e.target.value })}
                        maxLength={500}
                        rows={4}
                        className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm resize-none"
                      />
                      <p className="text-xs text-muted-foreground">{form.bio.length}/500</p>
                    </div>
                    <Button type="submit" className="w-full" disabled={saving}>
                      {saving ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Personables Section */}
          {activeSection === "personables" && (
            <Card>
              <CardHeader>
                <CardTitle>Preferences</CardTitle>
                <CardDescription>Let potential roommates know about your living preferences</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePersonablesSave}>
                  <div className="flex flex-col gap-6">

                    {/* Pets */}
                    <div className="flex flex-col gap-3">
                      <p className="text-sm font-medium">Pets</p>
                      <div className="flex items-center justify-between border rounded-md px-4 py-3">
                        <Label htmlFor="has_pets">Do you have pets?</Label>
                        <button
                          type="button"
                          id="has_pets"
                          onClick={() => setPersonables({ ...personables, has_pets: !personables.has_pets })}
                          className={`w-10 h-6 rounded-full transition-colors ${
                            personables.has_pets ? "bg-primary" : "bg-muted"
                          } relative`}
                        >
                          <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                            personables.has_pets ? "left-5" : "left-1"
                          }`} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between border rounded-md px-4 py-3">
                        <Label htmlFor="pets_ok">Are you okay with pets in the room?</Label>
                        <button
                          type="button"
                          id="pets_ok"
                          onClick={() => setPersonables({ ...personables, pets_ok: !personables.pets_ok })}
                          className={`w-10 h-6 rounded-full transition-colors ${
                            personables.pets_ok ? "bg-primary" : "bg-muted"
                          } relative`}
                        >
                          <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                            personables.pets_ok ? "left-5" : "left-1"
                          }`} />
                        </button>
                      </div>
                    </div>

                    {/* Smoking */}
                    <div className="flex flex-col gap-3">
                      <p className="text-sm font-medium">Smoking</p>
                      <div className="flex items-center justify-between border rounded-md px-4 py-3">
                        <Label htmlFor="smoking_ok">Is smoking okay?</Label>
                        <button
                          type="button"
                          id="smoking_ok"
                          onClick={() => setPersonables({ ...personables, smoking_ok: !personables.smoking_ok })}
                          className={`w-10 h-6 rounded-full transition-colors ${
                            personables.smoking_ok ? "bg-primary" : "bg-muted"
                          } relative`}
                        >
                          <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                            personables.smoking_ok ? "left-5" : "left-1"
                          }`} />
                        </button>
                      </div>
                    </div>

                    {/* Sleep Schedule */}
                    <div className="flex flex-col gap-3">
                      <p className="text-sm font-medium">Sleep Schedule</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="bedtime">Bedtime</Label>
                          <Input
                            id="bedtime"
                            type="time"
                            value={personables.bedtime}
                            onChange={(e) => setPersonables({ ...personables, bedtime: e.target.value })}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="waketime">Wake Time</Label>
                          <Input
                            id="waketime"
                            type="time"
                            value={personables.waketime}
                            onChange={(e) => setPersonables({ ...personables, waketime: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Guest Tolerance */}
                    <div className="flex flex-col gap-3">
                      <p className="text-sm font-medium">Guest Tolerance</p>
                      <div className="flex flex-col gap-2">
                        <input
                          type="range"
                          min={1}
                          max={5}
                          value={personables.guest_tolerance}
                          onChange={(e) => setPersonables({ ...personables, guest_tolerance: parseInt(e.target.value) })}
                          className="w-full accent-primary"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>No Guests</span>
                          <span className="font-medium text-foreground">{personables.guest_tolerance}</span>
                          <span>Frequent Guests</span>
                        </div>
                      </div>
                    </div>

                    {/* Noise Tolerance */}
                    <div className="flex flex-col gap-3">
                      <p className="text-sm font-medium">Noise Tolerance</p>
                      <div className="flex flex-col gap-2">
                        <input
                          type="range"
                          min={1}
                          max={5}
                          value={personables.noise_tolerance}
                          onChange={(e) => setPersonables({ ...personables, noise_tolerance: parseInt(e.target.value) })}
                          className="w-full accent-primary"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Quiet</span>
                          <span className="font-medium text-foreground">{personables.noise_tolerance}</span>
                          <span>Loud</span>
                        </div>
                      </div>
                    </div>

                    <Button type="submit" className="w-full" disabled={saving}>
                      {saving ? "Saving..." : "Save Preferences"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Change Password Section */}
          {activeSection === "password" && (
            <Card>
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>Enter your current password and choose a new one</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePasswordSave}>
                  <div className="flex flex-col gap-6">
                    <div className="grid gap-2">
                      <Label htmlFor="currentPassword">Current Password</Label>
                      <Input
                        id="currentPassword"
                        type="password"
                        required
                        value={passwordForm.currentPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="newPassword">New Password</Label>
                      <Input
                        id="newPassword"
                        type="password"
                        required
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="confirmPassword">Confirm New Password</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        required
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={saving}>
                      {saving ? "Updating..." : "Update Password"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
          {/* Rejected Users Section */}
          {activeSection === "rejected" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <h2 className="text-xl font-bold">Rejected Users</h2>
                <p className="text-sm text-muted-foreground">
                  Users you have rejected will no longer appear in your matches. You can unreject them here.
                </p>
              </div>
              {loadingRejected ? (
                <p className="text-muted-foreground text-sm">Loading...</p>
              ) : rejectedUsers.length === 0 ? (
                <Card>
                  <CardContent className="py-10 text-center">
                    <p className="text-muted-foreground">You haven&apos;t rejected anyone yet.</p>
                  </CardContent>
                </Card>
              ) : (
                rejectedUsers.map((user) => (
                  <Card key={user.username}>
                    <CardContent className="py-4">
                      <div className="flex items-start gap-4">
                        <div className="w-16 h-16 rounded-full border overflow-hidden bg-muted flex items-center justify-center shrink-0">
                          {user.profile_picture ? (
                            <img
                              src={user.profile_picture}
                              alt={user.first_name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-xl text-muted-foreground">
                              {user.first_name?.[0]?.toUpperCase() ?? "?"}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col gap-1 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">
                              {user.first_name} {user.last_name}
                            </p>
                            <span className="text-xs text-muted-foreground">@{user.username}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            {user.school_year && <span>{user.school_year}</span>}
                            {user.gender && <span>· {user.gender}</span>}
                          </div>
                          {user.bio && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{user.bio}</p>
                          )}
                        </div>
                        <div className="flex items-center shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={pendingUnreject === user.username}
                            onClick={() => handleUnreject(user)}
                          >
                            Unreject
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}