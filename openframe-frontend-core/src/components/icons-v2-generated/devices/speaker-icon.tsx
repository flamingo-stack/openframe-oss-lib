import type { SVGProps } from "react";
export interface SpeakerIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function SpeakerIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: SpeakerIconProps) {
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
        d="M17.875 5c0-1.036-.84-1.875-1.876-1.875H8c-1.036 0-1.875.84-1.875 1.875v14c0 1.035.84 1.875 1.875 1.875h8c1.035 0 1.875-.84 1.875-1.875zm2.25 14a4.125 4.125 0 0 1-4.126 4.125H8A4.125 4.125 0 0 1 3.875 19V5A4.125 4.125 0 0 1 8 .875h8A4.125 4.125 0 0 1 20.124 5v14Z"
      />
      <path
        fill={color}
        d="M14.376 15a2.376 2.376 0 1 0-4.752.002A2.376 2.376 0 0 0 14.376 15m-1.001 0a1.376 1.376 0 0 1-2.742.14l-.007-.14.007-.141A1.374 1.374 0 0 1 12 13.626l.14.007c.694.07 1.235.655 1.235 1.367M12.218 4.384a2.126 2.126 0 0 1-.219 4.24c-1.1 0-2.004-.836-2.113-1.908l-.01-.217.01-.218A2.125 2.125 0 0 1 12 4.375zM16.625 15a4.626 4.626 0 1 1-9.25 0 4.626 4.626 0 0 1 9.25 0"
      />
    </svg>
  );
}
