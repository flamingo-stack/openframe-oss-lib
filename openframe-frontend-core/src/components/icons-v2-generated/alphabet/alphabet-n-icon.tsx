import type { SVGProps } from "react";
export interface AlphabetNIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AlphabetNIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: AlphabetNIconProps) {
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
        d="M18.125 19.476c0 1.697-2.272 2.258-3.063.757L8.125 7.051v12.95a1.125 1.125 0 0 1-2.25 0V4.522c0-1.643 2.134-2.222 2.985-.89l.078.134 6.938 13.18V4a1.125 1.125 0 0 1 2.25 0z"
      />
    </svg>
  );
}
