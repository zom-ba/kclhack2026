"use client";

import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";

type ProfileRow = {
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
};

type RecordRow = {
  room_id: string;
  accumulated_seconds: number;
};

export default function useProfileData(
  user: User | null,
  currentRoomId: string | null,
  supabase: SupabaseClient,
) {
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [bio, setBio] = useState<string | null>(null);
  const [allRoomsSeconds, setAllRoomsSeconds] = useState(0);
  const [currentRoomSeconds, setCurrentRoomSeconds] = useState(0);

  const loadProfile = useCallback(async () => {
    if (!user) {
      setDisplayName("");
      setAvatarUrl(null);
      setBio(null);
      setAllRoomsSeconds(0);
      setCurrentRoomSeconds(0);
      return;
    }

    const [profileResult, recordsResult] = await Promise.all([
      supabase.from("profiles").select("display_name, avatar_url, bio").eq("user_id", user.id).maybeSingle(),
      supabase.from("user_records").select("room_id, accumulated_seconds").eq("user_id", user.id),
    ]);

    if (profileResult.data) {
      const profile = profileResult.data as ProfileRow;
      setDisplayName(profile.display_name);
      setAvatarUrl(profile.avatar_url);
      setBio(profile.bio);
    }

    const records = (recordsResult.data ?? []) as RecordRow[];
    setAllRoomsSeconds(records.reduce((total, record) => total + record.accumulated_seconds, 0));
    setCurrentRoomSeconds(
      records.find(({ room_id }) => room_id === currentRoomId)?.accumulated_seconds ?? 0,
    );
  }, [currentRoomId, supabase, user]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  async function updateProfile(nextDisplayName: string, nextBio: string) {
    if (!user) return false;
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: nextDisplayName.trim(), bio: nextBio.trim() || null })
      .eq("user_id", user.id);

    if (error) return false;
    await loadProfile();
    return true;
  }

  return {
    allRoomsSeconds,
    avatarUrl,
    bio,
    currentRoomSeconds,
    displayName,
    loadProfile,
    updateProfile,
  };
}
