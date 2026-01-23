import type { SVGProps } from "react";
export interface PlusAltIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function PlusAltIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: PlusAltIconProps) {
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
        d="M1.875 18v-2a1.125 1.125 0 0 1 2.25 0v2c0 1.035.84 1.875 1.875 1.875h2l.115.006a1.125 1.125 0 0 1 0 2.238L8 22.125H6A4.125 4.125 0 0 1 1.875 18m18 0v-2a1.125 1.125 0 0 1 2.25 0v2A4.125 4.125 0 0 1 18 22.125h-2a1.125 1.125 0 0 1 0-2.25h2c1.035 0 1.875-.84 1.875-1.875m-18-10V6A4.125 4.125 0 0 1 6 1.875h2l.115.006a1.125 1.125 0 0 1 0 2.238L8 4.125H6c-1.036 0-1.875.84-1.875 1.875v2a1.125 1.125 0 0 1-2.25 0m18 0V6c0-1.036-.84-1.875-1.875-1.875h-2a1.125 1.125 0 0 1 0-2.25h2A4.125 4.125 0 0 1 22.125 6v2a1.125 1.125 0 0 1-2.25 0m-8.999 8v-2.874H8a1.125 1.125 0 0 1 0-2.25h2.876V8a1.125 1.125 0 0 1 2.25 0v2.876h2.873l.116.005a1.125 1.125 0 0 1 0 2.239l-.115.006h-2.874v2.873a1.125 1.125 0 0 1-2.25 0Z"
      />
    </svg>
  );
}
