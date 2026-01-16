import type { SVGProps } from "react";
export interface ShuffleIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ShuffleIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: ShuffleIconProps) {
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
        d="M18.205 14.205a1.125 1.125 0 0 1 1.505-.078l.086.078 3 3a1.124 1.124 0 0 1 0 1.59l-3 3a1.125 1.125 0 0 1-1.59-1.59l1.079-1.08H17.5a4.13 4.13 0 0 1-3.3-1.65l-1.1-1.467a1.125 1.125 0 0 1 1.8-1.35l1.1 1.467c.355.472.91.75 1.5.75h1.785l-1.08-1.08-.078-.085a1.125 1.125 0 0 1 .078-1.505M5.5 4.875c1.298 0 2.52.611 3.3 1.65l1.1 1.467a1.125 1.125 0 1 1-1.8 1.35L7 7.874a1.88 1.88 0 0 0-1.5-.75H3a1.125 1.125 0 0 1 0-2.25h2.5Z"
      />
      <path
        fill={color}
        d="M18.205 2.205a1.125 1.125 0 0 1 1.505-.078l.086.078 3 3a1.126 1.126 0 0 1 0 1.59l-3 3a1.125 1.125 0 0 1-1.59-1.59l1.079-1.08H17.5c-.59 0-1.145.278-1.5.75l-7.2 9.6a4.12 4.12 0 0 1-3.3 1.65H3a1.125 1.125 0 1 1 0-2.25h2.5c.59 0 1.146-.278 1.5-.75l7.2-9.6a4.13 4.13 0 0 1 3.3-1.65h1.785l-1.08-1.08-.078-.084a1.125 1.125 0 0 1 .078-1.506"
      />
    </svg>
  );
}
