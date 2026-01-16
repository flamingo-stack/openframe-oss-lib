import type { SVGProps } from "react";
export interface Flip02LeftIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Flip02LeftIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Flip02LeftIconProps) {
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
        d="M19.875 14a5.876 5.876 0 0 0-5.876-5.875H3a1.125 1.125 0 0 1 0-2.25h11a8.126 8.126 0 0 1 0 16.25H9a1.125 1.125 0 1 1 0-2.25h5A5.875 5.875 0 0 0 19.874 14Z"
      />
      <path
        fill={color}
        d="M6.205 2.205a1.125 1.125 0 0 1 1.59 1.59L4.592 7l3.205 3.205.076.087a1.124 1.124 0 0 1-1.582 1.582l-.085-.078-4-4a1.125 1.125 0 0 1 0-1.59l4-4Z"
      />
    </svg>
  );
}
