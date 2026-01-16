import type { SVGProps } from "react";
export interface BookmarkCheckIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function BookmarkCheckIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: BookmarkCheckIconProps) {
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
        d="M18.875 5c0-1.035-.84-1.875-1.875-1.875H7c-1.036 0-1.875.84-1.875 1.875v15.748l6.2-4.647.156-.1a1.13 1.13 0 0 1 1.194.1l6.2 4.649zm2.25 16c0 1.697-1.877 2.688-3.268 1.792l-.131-.092L12 18.405 6.274 22.7c-1.357 1.018-3.276.111-3.394-1.538L2.875 21V5A4.125 4.125 0 0 1 7 .875h10A4.125 4.125 0 0 1 21.125 5z"
      />
      <path
        fill={color}
        d="M14.704 6.205a1.125 1.125 0 0 1 1.59 1.59l-4.5 4.5c-.438.44-1.15.44-1.59 0l-2-2-.077-.085A1.125 1.125 0 0 1 9.71 8.627l.085.078L11 9.91z"
      />
    </svg>
  );
}
