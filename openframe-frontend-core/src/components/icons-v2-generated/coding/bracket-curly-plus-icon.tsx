import type { SVGProps } from "react";
export interface BracketCurlyPlusIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function BracketCurlyPlusIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: BracketCurlyPlusIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      fill="none"
      viewBox="0 0 24 24"
      className={className}
      {...props}
    >
      <path
        fill={color}
        d="M2.375 18v-3c0-.355-.1-.702-.288-1L2 13.874l-.9-1.2c-.3-.4-.3-.95 0-1.35l.9-1.2.087-.124a1.9 1.9 0 0 0 .288-1.001V6A4.125 4.125 0 0 1 6.5 1.875h1a1.126 1.126 0 0 1 0 2.25h-1c-1.035 0-1.875.84-1.875 1.875v3c0 .78-.222 1.543-.636 2.2l-.189.276-.394.524.394.524.19.276c.413.656.635 1.42.635 2.2v3c0 1.035.84 1.875 1.875 1.875h1a1.126 1.126 0 0 1 0 2.25h-1A4.125 4.125 0 0 1 2.375 18m17 0v-3c0-.893.289-1.762.824-2.476l.393-.524-.393-.524A4.13 4.13 0 0 1 19.375 9V6c0-1.036-.84-1.875-1.875-1.875h-1a1.125 1.125 0 0 1 0-2.25h1A4.125 4.125 0 0 1 21.625 6v3c0 .406.131.8.375 1.125l.9 1.2c.3.4.3.95 0 1.35l-.9 1.2c-.244.325-.375.72-.375 1.125v3a4.125 4.125 0 0 1-4.125 4.125h-1a1.125 1.125 0 0 1 0-2.25h1c1.035 0 1.875-.84 1.875-1.875"
      />
      <path
        fill={color}
        d="M10.876 16v-2.874H8a1.125 1.125 0 0 1 0-2.25h2.876V8a1.125 1.125 0 0 1 2.25 0v2.876h2.873l.116.005a1.125 1.125 0 0 1 0 2.239l-.115.006h-2.874v2.873a1.125 1.125 0 0 1-2.25 0Z"
      />
    </svg>
  );
}
