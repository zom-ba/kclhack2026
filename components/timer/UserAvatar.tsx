"use client";

import type { CSSProperties } from "react";

type UserAvatarProps = {
  className?: string;
  seed: string;
};

const avatarColors = [
  "#7289a1",
  "#9b7777",
  "#728f86",
  "#8a7da1",
  "#a18369",
  "#657f91",
  "#8f746f",
  "#778c68",
];

function colorFromSeed(seed: string) {
  let hash = 0;
  for (const character of seed) {
    hash = ((hash << 5) - hash + character.codePointAt(0)!) | 0;
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

export default function UserAvatar({ className = "", seed }: UserAvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={`user-avatar${className ? ` ${className}` : ""}`}
      style={{ "--avatar-background": colorFromSeed(seed) } as CSSProperties}
    >
      <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
        <g transform="translate(0 3)">
          <circle cx="24" cy="16" r="8" />
          <path d="M5 59V47c0-12 7.5-19 19-19s19 7 19 19v12H5Z" />
        </g>
      </svg>
    </span>
  );
}
