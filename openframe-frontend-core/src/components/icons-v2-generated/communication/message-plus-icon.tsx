import type { SVGProps } from "react";
export interface MessagePlusIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function MessagePlusIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: MessagePlusIconProps) {
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
        d="M20.875 6c0-1.036-.84-1.875-1.875-1.875H5c-1.036 0-1.875.84-1.875 1.875v10c0 1.036.84 1.875 1.875 1.875h2c.62 0 1.125.504 1.125 1.125v1.77l3.534-2.25a4.13 4.13 0 0 1 2.215-.645H19c1.035 0 1.874-.84 1.875-1.875zm2.25 10A4.125 4.125 0 0 1 19 20.125h-5.126c-.268 0-.531.056-.773.166l-.233.128L9.14 22.79c-1.414.9-3.266-.115-3.266-1.791v-.873H5A4.125 4.125 0 0 1 .875 16V6A4.125 4.125 0 0 1 5 1.875h14A4.125 4.125 0 0 1 23.125 6z"
      />
      <path
        fill={color}
        d="M10.876 15v-2.874H8a1.125 1.125 0 0 1 0-2.25h2.876V7a1.125 1.125 0 0 1 2.25 0v2.875h2.873l.116.006a1.125 1.125 0 0 1 0 2.239l-.115.006h-2.874v2.873a1.125 1.125 0 0 1-2.25 0Z"
      />
    </svg>
  );
}
