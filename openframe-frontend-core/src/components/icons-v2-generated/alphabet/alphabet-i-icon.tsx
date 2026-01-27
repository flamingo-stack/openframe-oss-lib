import type { SVGProps } from "react";
export interface AlphabetIIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AlphabetIIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: AlphabetIIconProps) {
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
        d="m16 2.875.115.006a1.125 1.125 0 0 1 0 2.238L16 5.125h-2.874v13.75h2.873l.116.006a1.125 1.125 0 0 1 0 2.239l-.115.005H8a1.125 1.125 0 0 1 0-2.25h2.876V5.125H8a1.125 1.125 0 0 1 0-2.25z"
      />
    </svg>
  );
}
