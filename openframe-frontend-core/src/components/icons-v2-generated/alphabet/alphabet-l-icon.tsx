import type { SVGProps } from "react";
export interface AlphabetLIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AlphabetLIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: AlphabetLIconProps) {
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
        d="M6.375 4a1.125 1.125 0 0 1 2.25 0v14.875H16.5l.116.006a1.125 1.125 0 0 1 0 2.239l-.116.005H8A1.626 1.626 0 0 1 6.375 19.5z"
      />
    </svg>
  );
}
