import type { SVGProps } from "react";
export interface PlusIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function PlusIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: PlusIconProps) {
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
        d="M10.876 19v-5.874H5a1.125 1.125 0 0 1 0-2.25h5.876V5a1.125 1.125 0 0 1 2.25 0v5.876H19l.115.005a1.125 1.125 0 0 1 0 2.239l-.115.006h-5.874V19a1.125 1.125 0 0 1-2.25 0"
      />
    </svg>
  );
}
