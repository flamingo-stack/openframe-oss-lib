import type { SVGProps } from "react";
export interface PlusCircleIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function PlusCircleIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: PlusCircleIconProps) {
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
        d="M20.875 12a8.875 8.875 0 1 0-17.75 0 8.875 8.875 0 0 0 17.75 0m2.25 0c0 6.144-4.98 11.124-11.124 11.125S.875 18.145.875 12 5.856.875 12.001.875c6.143 0 11.124 4.981 11.124 11.126Z"
      />
      <path
        fill={color}
        d="M10.876 16v-2.874H8a1.125 1.125 0 0 1 0-2.25h2.876V8a1.125 1.125 0 0 1 2.25 0v2.876h2.873l.116.005a1.125 1.125 0 0 1 0 2.239l-.115.006h-2.874v2.873a1.125 1.125 0 0 1-2.25 0Z"
      />
    </svg>
  );
}
