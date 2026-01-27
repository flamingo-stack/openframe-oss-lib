import type { SVGProps } from "react";
export interface TabletIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function TabletIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: TabletIconProps) {
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
        d="M18.875 5c0-1.035-.84-1.875-1.875-1.875H7c-1.036 0-1.875.84-1.875 1.875v14c0 1.035.84 1.875 1.875 1.875h10c1.036 0 1.875-.84 1.875-1.875zm2.25 14A4.125 4.125 0 0 1 17 23.125H7A4.125 4.125 0 0 1 2.875 19V5A4.125 4.125 0 0 1 7 .875h10A4.125 4.125 0 0 1 21.125 5z"
      />
      <path
        fill={color}
        d="m14 17.875.115.006a1.125 1.125 0 0 1 0 2.238l-.114.006H10a1.125 1.125 0 0 1 0-2.25z"
      />
    </svg>
  );
}
