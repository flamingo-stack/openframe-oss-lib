import type { SVGProps } from "react";
export interface UserIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function UserIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: UserIconProps) {
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
        d="M15.126 7.25a3.126 3.126 0 1 0-6.252.002 3.126 3.126 0 0 0 6.252-.002m2.25 0a5.376 5.376 0 1 1-10.75 0 5.376 5.376 0 0 1 10.75 0m-8.233 8.875a4.014 4.014 0 0 0-4.005 3.75h13.724a4.015 4.015 0 0 0-4.005-3.75zm11.982 4.018a1.983 1.983 0 0 1-1.981 1.982H4.857a1.98 1.98 0 0 1-1.982-1.982 6.27 6.27 0 0 1 6.268-6.268h5.714a6.27 6.27 0 0 1 6.268 6.268"
      />
    </svg>
  );
}
