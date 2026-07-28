type SkillIconProps = {
  name: string;
  className?: string;
  size?: "sm" | "md";
};

const iconColors: Record<string, string> = {
  Figma: "#F24E1E",
  Photoshop: "#31A8FF",
  "After Effects": "#9999FF",
  CorelDraw: "#39C0BB",
  Blender: "#F5792A",
  Postman: "#FF6C37",
  Jira: "#2684FF",
  InDesign: "#FF3366",
  "Premiere Pro": "#9999FF",
  "Microsoft Office": "#D83B01",
  VSC: "#007ACC",
  Illustrator: "#FF9A00",
  "Adobe XD": "#FF61F6",
  Filmora: "#4D8EFF",
  "Unreal Engine": "#FFFFFF",
  WordPress: "#21759B",
  HTML: "#E34F26",
  JavaScript: "#F7DF1E",
  Django: "#092E20",
  CSS3: "#1572B6",
  PHP: "#777BB4",
  MySQL: "#4479A1",
  Bootstrap: "#7952B3",
  Python: "#3776AB",
};

function Glyph({ name }: { name: string }) {
  const stroke = "currentColor";

  switch (name) {
    case "Figma":
      return (
        <g fill="none" stroke={stroke} strokeWidth="1.6">
          <circle cx="9" cy="6" r="2.4" />
          <circle cx="9" cy="12" r="2.4" />
          <circle cx="9" cy="18" r="2.4" />
          <path d="M6.6 3.6h4.8a2.4 2.4 0 0 1 0 4.8H6.6z" />
          <path d="M6.6 8.4h4.8a2.4 2.4 0 0 1 0 4.8H6.6z" />
        </g>
      );
    case "Photoshop":
      return (
        <text x="12" y="16" textAnchor="middle" fontSize="9" fontWeight="700" fill={stroke}>
          Ps
        </text>
      );
    case "After Effects":
      return (
        <text x="12" y="16" textAnchor="middle" fontSize="9" fontWeight="700" fill={stroke}>
          Ae
        </text>
      );
    case "Illustrator":
      return (
        <text x="12" y="16" textAnchor="middle" fontSize="9" fontWeight="700" fill={stroke}>
          Ai
        </text>
      );
    case "InDesign":
      return (
        <text x="12" y="16" textAnchor="middle" fontSize="9" fontWeight="700" fill={stroke}>
          Id
        </text>
      );
    case "Premiere Pro":
      return (
        <text x="12" y="16" textAnchor="middle" fontSize="9" fontWeight="700" fill={stroke}>
          Pr
        </text>
      );
    case "Adobe XD":
      return (
        <text x="12" y="16" textAnchor="middle" fontSize="9" fontWeight="700" fill={stroke}>
          Xd
        </text>
      );
    case "Blender":
      return (
        <g fill="none" stroke={stroke} strokeWidth="1.6">
          <circle cx="12" cy="12" r="6.5" />
          <circle cx="12" cy="12" r="2.2" />
          <path d="M12 5.5v3M12 15.5v3M5.5 12h3M15.5 12h3" />
        </g>
      );
    case "Postman":
      return (
        <g fill="none" stroke={stroke} strokeWidth="1.6">
          <path d="M4 12h10l-3-3M14 12l-3 3" />
          <circle cx="18" cy="12" r="2" />
        </g>
      );
    case "Jira":
      return (
        <g fill="none" stroke={stroke} strokeWidth="1.6">
          <path d="M12 4l6 6-6 6-6-6z" />
          <path d="M12 8l3 3-3 3-3-3z" />
        </g>
      );
    case "VSC":
      return (
        <g fill="none" stroke={stroke} strokeWidth="1.6">
          <path d="M4 7l7 5-7 5V7z" />
          <path d="M11 12l8-6v12z" />
        </g>
      );
    case "WordPress":
      return (
        <g fill="none" stroke={stroke} strokeWidth="1.6">
          <circle cx="12" cy="12" r="7" />
          <path d="M7 15l3-9h1l3 9M8.5 12h4" />
        </g>
      );
    case "Unreal Engine":
      return (
        <text x="12" y="16" textAnchor="middle" fontSize="8" fontWeight="700" fill={stroke}>
          UE
        </text>
      );
    case "CorelDraw":
      return (
        <text x="12" y="16" textAnchor="middle" fontSize="8" fontWeight="700" fill={stroke}>
          CD
        </text>
      );
    case "Filmora":
      return (
        <g fill="none" stroke={stroke} strokeWidth="1.6">
          <rect x="4" y="6" width="16" height="12" rx="2" />
          <path d="M10 9.5l5 2.5-5 2.5z" />
        </g>
      );
    case "Microsoft Office":
      return (
        <text x="12" y="16" textAnchor="middle" fontSize="8" fontWeight="700" fill={stroke}>
          MS
        </text>
      );
    case "HTML":
      return (
        <text x="12" y="16" textAnchor="middle" fontSize="7" fontWeight="700" fill={stroke}>
          HTML
        </text>
      );
    case "CSS3":
      return (
        <text x="12" y="16" textAnchor="middle" fontSize="8" fontWeight="700" fill={stroke}>
          CSS
        </text>
      );
    case "JavaScript":
      return (
        <text x="12" y="16" textAnchor="middle" fontSize="8" fontWeight="700" fill={stroke}>
          JS
        </text>
      );
    case "Python":
      return (
        <g fill="none" stroke={stroke} strokeWidth="1.6">
          <path d="M9 5h6a3 3 0 0 1 3 3v3H12a3 3 0 0 0-3 3v5H8a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3z" />
          <path d="M15 19H9a3 3 0 0 1-3-3v-3h6a3 3 0 0 0 3-3V5h1a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3z" />
        </g>
      );
    case "Django":
      return (
        <text x="12" y="16" textAnchor="middle" fontSize="8" fontWeight="700" fill={stroke}>
          Dj
        </text>
      );
    case "PHP":
      return (
        <text x="12" y="16" textAnchor="middle" fontSize="8" fontWeight="700" fill={stroke}>
          PHP
        </text>
      );
    case "MySQL":
      return (
        <g fill="none" stroke={stroke} strokeWidth="1.6">
          <ellipse cx="12" cy="7" rx="7" ry="3" />
          <path d="M5 7v7c0 1.7 3.1 3 7 3s7-1.3 7-3V7" />
        </g>
      );
    case "Bootstrap":
      return (
        <text x="12" y="16" textAnchor="middle" fontSize="9" fontWeight="700" fill={stroke}>
          B
        </text>
      );
    default:
      return (
        <text x="12" y="16" textAnchor="middle" fontSize="9" fontWeight="700" fill={stroke}>
          {name.slice(0, 2)}
        </text>
      );
  }
}

export function SkillIcon({ name, className = "", size = "sm" }: SkillIconProps) {
  const color = iconColors[name] ?? "#ffffff";
  const isMd = size === "md";

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ color }}
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        className={isMd ? "h-6 w-6" : "h-5 w-5"}
        role="img"
      >
        <Glyph name={name} />
      </svg>
    </span>
  );
}
