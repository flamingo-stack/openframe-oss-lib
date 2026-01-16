import type { SVGProps } from "react";
export interface AlphabetPCircleIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AlphabetPCircleIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: AlphabetPCircleIconProps) {
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
        d="M13.375 10.25c0-.621-.504-1.125-1.125-1.125h-1.125v2.25h1.125c.621 0 1.125-.504 1.125-1.125m2.25 0a3.375 3.375 0 0 1-3.375 3.375h-1.125v2.374a1.125 1.125 0 0 1-2.25 0V8.214c0-.74.6-1.339 1.339-1.339h2.036a3.375 3.375 0 0 1 3.375 3.375"
      />
    </svg>
  );
}
