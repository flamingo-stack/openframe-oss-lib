import type { SVGProps } from "react";
export interface AlphabetFIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AlphabetFIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: AlphabetFIconProps) {
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
        d="M6.375 20V4.5c0-.898.727-1.625 1.625-1.625h8.5a1.125 1.125 0 0 1 0 2.25H8.625v5.25h6.874l.116.006a1.125 1.125 0 0 1 0 2.238l-.116.006H8.625V20a1.125 1.125 0 0 1-2.25 0"
      />
    </svg>
  );
}
