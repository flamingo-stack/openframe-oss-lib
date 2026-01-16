import type { SVGProps } from "react";
export interface BookBookmarkIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function BookBookmarkIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: BookBookmarkIconProps) {
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
        d="M2.875 5A4.125 4.125 0 0 1 7 .875h2.22l.115.006a1.125 1.125 0 0 1 0 2.238l-.116.006H7c-1.036 0-1.875.84-1.875 1.875v12.002c.278-.081.57-.127.875-.127h12a.877.877 0 0 0 .875-.876v-1.03a1.125 1.125 0 0 1 2.25 0v1.03c0 .905-.386 1.716-1 2.287v2.596a1.126 1.126 0 0 1-.01 2.237l-.114.006H6a3.125 3.125 0 0 1-3.109-2.806L2.875 20zm2.268 15.176a.875.875 0 0 0 .857.699h11.875v-1.75H6a.875.875 0 0 0-.875.875z"
      />
      <path
        fill={color}
        d="M18.875 3.5a.375.375 0 0 0-.375-.375h-4a.375.375 0 0 0-.375.375v5.604l1.627-1.445.17-.125a1.125 1.125 0 0 1 1.325.125l1.628 1.447zm2.25 6.998c0 1.314-1.456 2.05-2.502 1.37l-.203-.156-1.92-1.708-1.92 1.708c-1.049.93-2.704.187-2.705-1.214V3.5A2.625 2.625 0 0 1 14.5.875h4A2.625 2.625 0 0 1 21.125 3.5z"
      />
    </svg>
  );
}
