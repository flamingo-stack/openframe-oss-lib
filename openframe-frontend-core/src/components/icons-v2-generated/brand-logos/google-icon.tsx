import type { SVGProps } from "react";
export interface GoogleIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function GoogleIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: GoogleIconProps) {
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
        d="M17 10.874c.621 0 1.125.505 1.125 1.125a6.126 6.126 0 1 1-2.007-4.534l.213.204.078.085a1.126 1.126 0 0 1-1.584 1.584l-.085-.078-.275-.25a3.875 3.875 0 1 0 1.244 4.115h-3.71a1.125 1.125 0 0 1 0-2.25H17Z"
      />
    </svg>
  );
}
