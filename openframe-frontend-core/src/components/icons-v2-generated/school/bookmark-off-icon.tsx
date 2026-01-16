import type { SVGProps } from "react";
export interface BookmarkOffIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function BookmarkOffIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: BookmarkOffIconProps) {
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
        d="M18.875 13.34V5c0-1.036-.84-1.875-1.875-1.875H8.655a1.125 1.125 0 0 1 0-2.25H17A4.125 4.125 0 0 1 21.125 5v8.34a1.126 1.126 0 0 1-2.25 0M2.205 1.205a1.125 1.125 0 0 1 1.506-.078l.085.078 19 19 .076.085a1.125 1.125 0 0 1-1.582 1.582l-.085-.076-.171-.172c-.39 1.299-1.966 1.947-3.176 1.168l-.133-.092L12 18.405 6.276 22.7c-1.358 1.018-3.276.11-3.394-1.538L2.876 21V5l.01-.292q.039-.535.205-1.026l-.886-.887-.078-.085a1.125 1.125 0 0 1 .078-1.505m2.92 19.544 6.2-4.648.157-.1a1.13 1.13 0 0 1 1.194.1l6.199 4.648v-1.284L5.125 5.716z"
      />
    </svg>
  );
}
