import type { SVGProps } from "react";
export interface GiftIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function GiftIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: GiftIconProps) {
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
        d="M10.876 11a1.125 1.125 0 0 1 2.25 0v9.875H17.5c1.035 0 1.875-.84 1.875-1.875v-8.063a1.125 1.125 0 0 1 2.25 0V19a4.125 4.125 0 0 1-4.125 4.125h-11A4.125 4.125 0 0 1 2.375 19v-8.063a1.125 1.125 0 0 1 2.25 0V19c0 1.035.84 1.875 1.875 1.875h4.376z"
      />
      <path
        fill={color}
        d="M20.875 8A.875.875 0 0 0 20 7.126h-6.874v2.75H20A.875.875 0 0 0 20.875 9zm-4.546-4.706a1.14 1.14 0 0 0-1.491.277l-.065.095-.75 1.209H16.7l.014-.024.055-.102a1.14 1.14 0 0 0-.345-1.39zm-7.101.372A1.137 1.137 0 0 0 7.287 4.85l.014.025h2.677zM3.125 9c0 .483.391.875.875.876h6.876V7.125H4A.876.876 0 0 0 3.125 8zm20 0A3.125 3.125 0 0 1 20 12.126H4A3.126 3.126 0 0 1 .875 9V8A3.126 3.126 0 0 1 4 4.876h.933a3.385 3.385 0 0 1 6.206-2.395L12 3.867l.863-1.387.195-.283a3.39 3.39 0 0 1 4.44-.826l.285.193a3.39 3.39 0 0 1 1.286 3.31H20c1.726 0 3.125 1.4 3.125 3.127z"
      />
    </svg>
  );
}
