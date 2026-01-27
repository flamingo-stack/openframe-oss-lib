import type { SVGProps } from "react";
export interface YoutubeIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function YoutubeIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: YoutubeIconProps) {
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
        d="M20.875 7c0-1.036-.84-1.875-1.875-1.875H5c-1.036 0-1.875.84-1.875 1.875v10c0 1.036.84 1.875 1.875 1.875h14c1.035 0 1.874-.84 1.875-1.875zm2.25 10A4.125 4.125 0 0 1 19 21.125H5A4.125 4.125 0 0 1 .875 17V7A4.125 4.125 0 0 1 5 2.875h14A4.125 4.125 0 0 1 23.125 7z"
      />
      <path
        fill={color}
        d="M8.644 8.896c.17-1.19 1.476-1.874 2.55-1.336l.227.134 3.843 2.663a2 2 0 0 1 0 3.287l-3.843 2.663c-1.18.818-2.796-.028-2.796-1.465V9.158zm2.231 5.051L13.685 12l-2.81-1.948z"
      />
    </svg>
  );
}
