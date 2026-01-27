import type { SVGProps } from "react";
export interface BoldAltIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function BoldAltIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: BoldAltIconProps) {
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
        d="M17.375 16a2.876 2.876 0 0 0-2.875-2.876H8.625v5.751H14.5A2.876 2.876 0 0 0 17.375 16m-1-8a2.876 2.876 0 0 0-2.876-2.875H8.625v5.75h4.874A2.875 2.875 0 0 0 16.375 8m2.25 0c0 1.407-.568 2.68-1.485 3.607a5.126 5.126 0 0 1-2.64 9.519h-9a1.125 1.125 0 0 1 0-2.25h.875V5.124H5.5a1.125 1.125 0 0 1 0-2.25h8A5.126 5.126 0 0 1 18.624 8Z"
      />
    </svg>
  );
}
