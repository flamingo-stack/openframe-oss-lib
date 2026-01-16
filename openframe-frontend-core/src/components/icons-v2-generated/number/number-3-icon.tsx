import type { SVGProps } from "react";
export interface Number3IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Number3Icon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Number3IconProps) {
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
        d="M15.375 15.5A3.375 3.375 0 0 0 12 12.127h-.1a1.125 1.125 0 0 1 0-2.25h.2a2.376 2.376 0 1 0 0-4.75h-.2a2.37 2.37 0 0 0-2.147 1.357L7.72 5.518a4.63 4.63 0 0 1 4.18-2.643h.199A4.626 4.626 0 0 1 16.726 7.5a4.6 4.6 0 0 1-1.495 3.396A5.625 5.625 0 0 1 12 21.125c-2.288 0-4.52-1.388-5.41-3.464l-.16-.423-.03-.111a1.125 1.125 0 0 1 2.128-.693l.041.107.091.24c.513 1.183 1.878 2.095 3.34 2.095a3.375 3.375 0 0 0 3.375-3.376M9.753 6.484a1.125 1.125 0 0 1-2.032-.965z"
      />
    </svg>
  );
}
