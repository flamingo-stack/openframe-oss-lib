import type { SVGProps } from "react";
export interface AlphabetTIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AlphabetTIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: AlphabetTIconProps) {
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
        d="M10.874 20V5.125H7a1.125 1.125 0 0 1 0-2.25h10l.115.006a1.125 1.125 0 0 1 0 2.238L17 5.125h-3.877V20a1.125 1.125 0 0 1-2.25 0Z"
      />
    </svg>
  );
}
