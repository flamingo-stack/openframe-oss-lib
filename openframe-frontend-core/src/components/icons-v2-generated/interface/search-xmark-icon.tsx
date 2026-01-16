import type { SVGProps } from "react";
export interface SearchXmarkIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function SearchXmarkIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: SearchXmarkIconProps) {
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
        d="M6.548 15.86a1.126 1.126 0 0 1 1.59 1.592l-4.343 4.343a1.125 1.125 0 1 1-1.59-1.59zm8.156-8.155a1.125 1.125 0 0 1 1.59 1.59L14.59 11l1.705 1.705.078.086a1.124 1.124 0 0 1-1.583 1.583l-.086-.078L13 12.59l-1.704 1.705a1.125 1.125 0 1 1-1.59-1.59l1.703-1.706-1.703-1.704-.078-.085a1.125 1.125 0 0 1 1.583-1.583l.085.078L13 9.408z"
      />
      <path
        fill={color}
        d="M19.875 11a6.876 6.876 0 1 0-13.751.002A6.876 6.876 0 0 0 19.876 11Zm2.25 0a9.126 9.126 0 1 1-18.25 0 9.126 9.126 0 0 1 18.25 0"
      />
    </svg>
  );
}
