import type { SVGProps } from "react";
export interface CollectionVideoIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CollectionVideoIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: CollectionVideoIconProps) {
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
        d="M.875 18V9A8.126 8.126 0 0 1 9 .875h9l.115.006a1.125 1.125 0 0 1 0 2.238L18 3.125H9A5.876 5.876 0 0 0 3.124 9v9a1.125 1.125 0 0 1-2.25 0Zm9.75-6.842c0-1.347 1.419-2.174 2.57-1.598l.226.133 3.843 2.663a2 2 0 0 1 0 3.288l-3.843 2.663c-1.18.818-2.796-.028-2.796-1.465zm2.25 4.789L15.685 14l-2.81-1.948z"
      />
      <path
        fill={color}
        d="M20.875 9c0-1.035-.84-1.875-1.875-1.875H9c-1.036 0-1.875.84-1.875 1.875v10c0 1.036.84 1.875 1.875 1.875h10c1.036 0 1.875-.84 1.875-1.875zm2.25 10A4.126 4.126 0 0 1 19 23.125H9A4.125 4.125 0 0 1 4.875 19V9A4.125 4.125 0 0 1 9 4.875h10A4.125 4.125 0 0 1 23.125 9z"
      />
    </svg>
  );
}
