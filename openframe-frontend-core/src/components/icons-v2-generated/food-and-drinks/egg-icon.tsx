import type { SVGProps } from "react";
export interface EggIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function EggIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: EggIconProps) {
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
        d="M18.875 13.45c0-1.98-.797-4.64-2.143-6.8-1.374-2.205-3.08-3.525-4.732-3.525s-3.359 1.32-4.733 3.526c-1.346 2.159-2.142 4.818-2.142 6.798v.547c0 3.63 3.094 6.875 6.874 6.876 3.78 0 6.876-3.247 6.876-6.876v-.547Zm2.25.546c0 4.838-4.07 9.126-9.126 9.126s-9.124-4.288-9.124-9.126v-.547c0-2.468.954-5.534 2.483-7.988C6.858 3.055 9.152.875 11.999.875s5.143 2.18 6.644 4.586c1.529 2.454 2.482 5.52 2.482 7.988z"
      />
      <path
        fill={color}
        d="M6.875 14a1.125 1.125 0 0 1 2.25 0 2.876 2.876 0 0 0 2.581 2.86l.295.016.114.005a1.126 1.126 0 0 1 0 2.239l-.114.006-.264-.008A5.125 5.125 0 0 1 6.875 14"
      />
    </svg>
  );
}
