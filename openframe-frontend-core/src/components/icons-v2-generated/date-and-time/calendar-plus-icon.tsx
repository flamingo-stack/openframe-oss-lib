import type { SVGProps } from "react";
export interface CalendarPlusIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CalendarPlusIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: CalendarPlusIconProps) {
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
        d="M21 6.875a1.125 1.125 0 0 1 0 2.25H3a1.125 1.125 0 0 1 0-2.25z"
      />
      <path
        fill={color}
        d="M19.875 6c0-.996-.778-1.81-1.76-1.87a1.124 1.124 0 0 1-2.233-.005H8.118a1.125 1.125 0 0 1-2.235.005A1.874 1.874 0 0 0 4.125 6v12c0 1.036.84 1.875 1.875 1.875h12c1.035 0 1.875-.84 1.875-1.875zm-9 11.5v-1.876H9a1.125 1.125 0 0 1 0-2.25h1.875V11.5a1.125 1.125 0 0 1 2.25 0v1.875H15l.116.006a1.126 1.126 0 0 1 0 2.239l-.116.005h-1.875V17.5a1.125 1.125 0 0 1-2.25 0m11.25.5A4.125 4.125 0 0 1 18 22.125H6A4.125 4.125 0 0 1 1.875 18V6a4.12 4.12 0 0 1 4.006-4.119 1.125 1.125 0 0 1 2.237-.006h7.764a1.125 1.125 0 0 1 2.235.006 4.12 4.12 0 0 1 4.008 4.12v12Z"
      />
    </svg>
  );
}
