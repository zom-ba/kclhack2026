"use client";

export type PanelId = "room" | "participants" | "profile";

type NavigationProps = {
  activePanel: PanelId | null;
  onSelect: (panel: PanelId) => void;
};

const items: { id: PanelId; label: string; icon: string }[] = [
  { id: "room", label: "ルーム情報", icon: "⌂" },
  { id: "participants", label: "参加者", icon: "♙" },
  { id: "profile", label: "プロフィール", icon: "⚙" },
];

export default function Navigation({ activePanel, onSelect }: NavigationProps) {
  return (
    <nav className="panel-navigation" aria-label="情報パネル">
      {items.map((item) => (
        <button
          aria-label={item.label}
          aria-pressed={activePanel === item.id}
          className={`nav-button${activePanel === item.id ? " is-active" : ""}`}
          key={item.id}
          onClick={() => onSelect(item.id)}
          title={item.label}
          type="button"
        >
          <span aria-hidden="true" className="nav-icon">
            {item.id === "participants" ? (
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="7" r="3.5" />
                <path d="M4.5 21v-1.5a7.5 7.5 0 0 1 15 0V21" />
              </svg>
            ) : item.icon}
          </span>
          <span className="nav-label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
