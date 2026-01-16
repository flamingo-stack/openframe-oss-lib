import type { SVGProps } from "react";
export interface CouchIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CouchIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: CouchIconProps) {
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
        d="M18.875 10V7c0-1.035-.84-1.875-1.875-1.875H7c-1.036 0-1.875.84-1.875 1.875v3a1.125 1.125 0 0 1-2.25 0V7A4.125 4.125 0 0 1 7 2.875h10A4.125 4.125 0 0 1 21.125 7v3a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M4.875 12a.875.875 0 0 0-1.75 0v4c0 .423.3.775.699.857l.176.018h16l.176-.018a.875.875 0 0 0 .699-.857v-4a.874.874 0 1 0-1.75 0v2c0 .621-.504 1.125-1.125 1.126H6A1.125 1.125 0 0 1 4.875 14v-2.002Zm18.25 4c0 1.329-.83 2.46-2 2.912V20a1.125 1.125 0 0 1-2.25 0v-.875H5.125V20a1.125 1.125 0 0 1-2.25 0v-1.088a3.12 3.12 0 0 1-2-2.912v-4a3.125 3.125 0 0 1 6.25 0v.876h9.75v-.877a3.125 3.125 0 0 1 6.25 0z"
      />
    </svg>
  );
}
