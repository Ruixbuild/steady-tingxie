import Link from "next/link";

const TABS = [
  { label: "Focus", href: "/parent", enabled: true },
  { label: "Upload", href: "/parent/upload", enabled: true },
  { label: "Lists", href: "#", enabled: false },
  { label: "Reports", href: "#", enabled: false },
  { label: "Settings", href: "#", enabled: false },
];

export default function ParentTabs({ active }: { active: "Focus" | "Upload" }) {
  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {TABS.map((tab) =>
        tab.enabled ? (
          <Link
            key={tab.label}
            href={tab.href}
            className="btn"
            style={{
              minHeight: 40,
              padding: "0 20px",
              background: tab.label === active ? "var(--accent)" : "#fff",
              color: tab.label === active ? "#fff" : "var(--accent)",
              border: `1px solid ${tab.label === active ? "var(--accent)" : "var(--line)"}`,
            }}
          >
            {tab.label}
          </Link>
        ) : (
          <span
            key={tab.label}
            className="btn"
            style={{
              minHeight: 40,
              padding: "0 20px",
              background: "#fff",
              color: "var(--mut)",
              border: "1px solid var(--line)",
              opacity: 0.5,
              cursor: "not-allowed",
            }}
            title="Coming soon"
          >
            {tab.label}
          </span>
        )
      )}
    </div>
  );
}
