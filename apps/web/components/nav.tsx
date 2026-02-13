import Link from "next/link";

const links = [
  ["Overview", "/overview"],
  ["CME", "/cme"],
  ["Relations", "/relations"],
  ["Settings", "/settings"]
] as const;

export function TopNav() {
  return (
    <nav className="topnav" aria-label="Primary">
      {links.map(([label, href]) => (
        <Link key={href} href={href}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
