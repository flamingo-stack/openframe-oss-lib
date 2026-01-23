import type { SVGProps } from "react";
export interface CameraIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CameraIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: CameraIconProps) {
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
        d="M20.875 9c0-1.036-.84-1.875-1.875-1.875h-1.465a2.13 2.13 0 0 1-1.607-.735l-.161-.211-1.37-2.054H9.603l-1.37 2.054a2.13 2.13 0 0 1-1.768.946H5c-1.036 0-1.875.84-1.875 1.875v9c0 1.035.84 1.875 1.875 1.875h14c1.035 0 1.875-.84 1.875-1.875zm2.25 9A4.125 4.125 0 0 1 19 22.125H5A4.125 4.125 0 0 1 .875 18V9A4.125 4.125 0 0 1 5 4.875h1.397l1.37-2.054.16-.21c.4-.465.987-.736 1.608-.736h4.93c.62 0 1.207.272 1.608.735l.16.211 1.37 2.054h1.396A4.125 4.125 0 0 1 23.126 9v9Z"
      />
      <path
        fill={color}
        d="M14.874 13a2.875 2.875 0 1 0-5.75 0 2.875 2.875 0 0 0 5.75 0m2.25 0a5.124 5.124 0 1 1-10.248 0 5.124 5.124 0 0 1 10.248 0"
      />
    </svg>
  );
}
