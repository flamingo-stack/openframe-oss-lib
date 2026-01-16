import type { SVGProps } from "react";
export interface CropIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CropIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: CropIconProps) {
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
        d="M4.875 15V7.126H2a1.125 1.125 0 0 1 0-2.25h2.875V2a1.125 1.125 0 0 1 2.25 0v13c0 1.036.84 1.875 1.875 1.875h5l.116.006a1.125 1.125 0 0 1 0 2.239l-.116.005H9a4.125 4.125 0 0 1-4.125-4.124ZM22 16.876l.115.006a1.125 1.125 0 0 1 0 2.239l-.115.005h-4a1.125 1.125 0 0 1 0-2.25z"
      />
      <path
        fill={color}
        d="M16.875 22V9c0-1.036-.84-1.875-1.876-1.875H10a1.125 1.125 0 0 1 0-2.25h5A4.125 4.125 0 0 1 19.124 9v13a1.125 1.125 0 0 1-2.25 0Z"
      />
    </svg>
  );
}
