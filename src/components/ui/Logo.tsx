interface LogoProps {
  className?: string;
  size?: number;
  variant?: "full" | "icon";
  light?: boolean;
}

export default function Logo({
  className = "",
  size = 36,
  variant = "full",
  light = false,
}: LogoProps) {
  const textColor = light ? "#FFF9E5" : "#004030";
  const accentColor = "#4A9782";

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        
        <path d="M20 2L36 11V29L20 38L4 29V11L20 2Z" fill="#004030" />
        
        <rect x="11" y="12" width="18" height="3.5" rx="1.75" fill="#FFF9E5" />
        <rect
          x="18.25"
          y="12"
          width="3.5"
          height="16"
          rx="1.75"
          fill="#FFF9E5"
        />
        
        <circle cx="28" cy="28" r="4" fill={accentColor} />
        <path
          d="M26.5 28L27.5 29L29.5 27"
          stroke="#FFF9E5"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {variant === "full" && (
        <span
          style={{ color: textColor, fontFamily: "var(--font-headline)" }}
          className="text-2xl font-black tracking-tight leading-none"
        >
          Task<span style={{ color: accentColor }}>Hub</span>
        </span>
      )}
    </span>
  );
}
