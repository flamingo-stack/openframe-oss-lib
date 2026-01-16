import type { SVGProps } from "react";
export interface DoorIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function DoorIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: DoorIconProps) {
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
        d="M17.375 22V5c0-1.035-.84-1.875-1.874-1.875H8.5c-1.036 0-1.875.84-1.875 1.875v17a1.125 1.125 0 0 1-2.25 0V5A4.125 4.125 0 0 1 8.5.875h7A4.125 4.125 0 0 1 19.626 5v17a1.125 1.125 0 0 1-2.25 0Z"
      />
      <path
        fill={color}
        d="M21 20.875a1.125 1.125 0 0 1 0 2.25H3a1.125 1.125 0 0 1 0-2.25zM9 11.629a.62.62 0 0 0-.125.37l.012.127c.019.09.06.172.113.244zm1 .741a.6.6 0 0 0 .112-.244l.013-.127-.013-.126A.6.6 0 0 0 10 11.63v.741Zm1.126-.37a1.625 1.625 0 0 1-3.242.167l-.009-.168.009-.165A1.625 1.625 0 0 1 9.5 10.375l.166.009c.82.083 1.46.774 1.46 1.615Z"
      />
    </svg>
  );
}
