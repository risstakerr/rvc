type IconName =
  | "camera"
  | "camera-off"
  | "check"
  | "copy"
  | "link-off"
  | "mic"
  | "mic-off"
  | "phone-off"
  | "record"
  | "screen"
  | "send"
  | "stop"
  | "users"
  | "video";

interface IconProps {
  name: IconName;
  size?: number;
  strokeWidth?: number;
}

/** Íconos SVG de trazo, compatibles visualmente con Heroicons/Tailwind. */
export function Icon({ name, size = 20, strokeWidth = 1.8 }: IconProps) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (name) {
    case "mic": return <svg {...common}><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" /></svg>;
    case "mic-off": return <svg {...common}><path d="m4 4 16 16" /><path d="M9 9v3a3 3 0 0 0 4.9 2.3M15 10V5a3 3 0 0 0-5.8-1M5 10v2a7 7 0 0 0 11.2 5.6M12 19v3M8 22h8" /></svg>;
    case "camera": return <svg {...common}><path d="M15 10 20 7v10l-5-3" /><rect x="3" y="6" width="12" height="12" rx="2" /></svg>;
    case "camera-off": return <svg {...common}><path d="m3 3 18 18" /><path d="M10.6 6H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1.4M15 10l5-3v10l-2.1-1.3" /></svg>;
    case "screen": return <svg {...common}><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></svg>;
    case "phone-off": return <svg {...common}><path d="m4 4 16 16" /><path d="M8.2 5.1 6.9 3.8a2 2 0 0 0-2.8 0l-.8.8a2 2 0 0 0-.5 2C4.2 12.7 9.3 17.8 15.4 19.2a2 2 0 0 0 2-.5l.8-.8a2 2 0 0 0 0-2.8l-1.3-1.3-2.3 1.2a12.5 12.5 0 0 1-5.6-5.6Z" /></svg>;
    case "record": return <svg {...common}><circle cx="12" cy="12" r="7" fill="currentColor" stroke="none" /></svg>;
    case "stop": return <svg {...common}><rect x="7" y="7" width="10" height="10" rx="1" fill="currentColor" stroke="none" /></svg>;
    case "copy": return <svg {...common}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>;
    case "check": return <svg {...common}><path d="m5 12 4 4L19 6" /></svg>;
    case "link-off": return <svg {...common}><path d="m10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1M4 4l16 16" /></svg>;
    case "users": return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></svg>;
    case "send": return <svg {...common}><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>;
    case "video": return <svg {...common}><path d="M15 10 20 7v10l-5-3" /><rect x="3" y="6" width="12" height="12" rx="2" /><path d="M7 3h6" /></svg>;
  }
}
