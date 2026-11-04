"use client";

import ParticipantsPanel from "@/components/timer/panels/ParticipantsPanel";
import ProfilePanel from "@/components/timer/panels/ProfilePanel";
import RoomInfoPanel from "@/components/timer/panels/RoomInfoPanel";
import type { PanelId } from "@/components/timer/Navigation";

type SidePanelProps = {
  activePanel: PanelId | null;
};

const panelContent = {
  room: <RoomInfoPanel />,
  participants: <ParticipantsPanel />,
  profile: <ProfilePanel />,
};

const panelTitles: Record<PanelId, string> = {
  room: "ルーム情報",
  participants: "参加者",
  profile: "プロフィール",
};

export default function SidePanel({ activePanel }: SidePanelProps) {
  if (!activePanel) return null;

  return (
    <section aria-label={panelTitles[activePanel]} className="side-panel">
      <div className="panel-heading">
        <h2>{panelTitles[activePanel]}</h2>
      </div>
      <div className="panel-content">{panelContent[activePanel]}</div>
    </section>
  );
}
