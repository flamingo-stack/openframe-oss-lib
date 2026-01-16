import type { SVGProps } from "react";
export interface BagAltIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function BagAltIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: BagAltIconProps) {
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
        d="M6.875 8a1.125 1.125 0 0 1 2.25 0 2.876 2.876 0 0 0 5.75 0 1.125 1.125 0 0 1 2.25 0 5.125 5.125 0 1 1-10.25 0"
      />
      <path
        fill={color}
        d="M17.835 1.875a4.126 4.126 0 0 1 4.119 3.896l.666 12a4.125 4.125 0 0 1-4.119 4.354H5.504a4.125 4.125 0 0 1-4.12-4.354l.667-12A4.126 4.126 0 0 1 6.17 1.875zM6.17 4.125c-.995 0-1.817.777-1.872 1.771l-.667 12a1.875 1.875 0 0 0 1.873 1.979H18.5a1.875 1.875 0 0 0 1.872-1.979l-.666-12a1.875 1.875 0 0 0-1.872-1.771z"
      />
    </svg>
  );
}
