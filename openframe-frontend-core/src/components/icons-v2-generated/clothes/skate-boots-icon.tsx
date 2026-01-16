import type { SVGProps } from "react";
export interface SkateBootsIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function SkateBootsIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: SkateBootsIconProps) {
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
        d="M20.101 19.325a1.125 1.125 0 1 1 1.799 1.35 6.12 6.12 0 0 1-4.9 2.45H2a1.125 1.125 0 0 1 0-2.25h1.875V20a1.125 1.125 0 0 1 2.25 0v.875h8.75V20a1.125 1.125 0 0 1 2.25 0v.87a3.87 3.87 0 0 0 2.976-1.545m-7.7-10.45.114.006a1.125 1.125 0 0 1 0 2.238l-.115.006H9a1.125 1.125 0 0 1 0-2.25zm-1.401-3a1.125 1.125 0 0 1 0 2.25H9a1.125 1.125 0 0 1 0-2.25z"
      />
      <path
        fill={color}
        d="M9.875 4A.875.875 0 0 0 9 3.125H5A.875.875 0 0 0 4.125 4v10c0 1.036.84 1.875 1.875 1.875h9.422c.802 0 1.453-.65 1.453-1.453 0-.977-.615-1.848-1.535-2.177l-4.718-1.686A1.125 1.125 0 0 1 9.875 9.5zm2.25 4.706 3.972 1.42.334.134a4.56 4.56 0 0 1 2.694 4.162 3.703 3.703 0 0 1-3.703 3.703H6A4.125 4.125 0 0 1 1.875 14V4A3.125 3.125 0 0 1 5 .875h4A3.125 3.125 0 0 1 12.124 4z"
      />
    </svg>
  );
}
