import type { SVGProps } from "react";
export interface PlaylistIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function PlaylistIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: PlaylistIconProps) {
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
        d="M20.875 12c0-1.036-.84-1.875-1.875-1.875H5c-1.036 0-1.875.84-1.875 1.875v7c0 1.036.84 1.875 1.875 1.875h14c1.035 0 1.874-.84 1.875-1.875zm2.25 7A4.125 4.125 0 0 1 19 23.125H5A4.125 4.125 0 0 1 .875 19v-7A4.125 4.125 0 0 1 5 7.875h14A4.125 4.125 0 0 1 23.125 12zM19 4.375l.115.005a1.125 1.125 0 0 1 0 2.239L19 6.625H5a1.125 1.125 0 0 1 0-2.25zm-2-3.5.116.006a1.125 1.125 0 0 1 0 2.238L17 3.125H7a1.125 1.125 0 0 1 0-2.25z"
      />
    </svg>
  );
}
