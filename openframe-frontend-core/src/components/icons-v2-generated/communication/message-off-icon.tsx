import type { SVGProps } from "react";
export interface MessageOffIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function MessageOffIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: MessageOffIconProps) {
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
        d="M23.101 16.443a1.125 1.125 0 0 1-2.237-.239zM20.875 16V6c0-1.035-.84-1.875-1.875-1.875H8.66a1.125 1.125 0 0 1 0-2.25H19A4.125 4.125 0 0 1 23.125 6v10q0 .224-.024.443l-1.119-.12-1.118-.119a2 2 0 0 0 .01-.204ZM1.205 1.205a1.125 1.125 0 0 1 1.505-.078l.085.078 19 19 .077.085a1.125 1.125 0 0 1-1.582 1.582l-.085-.076-1.671-1.671h-4.66a1.9 1.9 0 0 0-.774.167l-.232.127-3.727 2.372c-1.415.9-3.267-.116-3.267-1.793v-.873H5A4.125 4.125 0 0 1 .875 16V6c0-.989.35-1.895.93-2.605l-.6-.6-.078-.084a1.125 1.125 0 0 1 .078-1.506M3.125 16c0 1.035.84 1.875 1.875 1.875h2c.62 0 1.124.503 1.124 1.125v1.77l3.535-2.25.252-.149a4.1 4.1 0 0 1 1.963-.496h2.41L3.414 5.005c-.182.289-.29.63-.29.996V16Z"
      />
    </svg>
  );
}
