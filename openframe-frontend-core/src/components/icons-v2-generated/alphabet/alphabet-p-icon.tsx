import type { SVGProps } from "react";
export interface AlphabetPIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AlphabetPIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: AlphabetPIconProps) {
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
        d="M15.875 8.5A3.375 3.375 0 0 0 12.5 5.125H9.125v6.75H12.5A3.375 3.375 0 0 0 15.875 8.5m2.25 0a5.625 5.625 0 0 1-5.625 5.625H9.125V20a1.125 1.125 0 0 1-2.25 0V4.43c0-.859.696-1.555 1.554-1.555H12.5A5.625 5.625 0 0 1 18.125 8.5"
      />
    </svg>
  );
}
