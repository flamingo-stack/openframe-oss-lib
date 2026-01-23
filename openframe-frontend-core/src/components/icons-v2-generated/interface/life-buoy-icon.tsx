import type { SVGProps } from "react";
export interface LifeBuoyIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function LifeBuoyIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: LifeBuoyIconProps) {
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
        d="M14.875 12a2.876 2.876 0 1 0-5.752 0 2.876 2.876 0 0 0 5.752 0m2.25 0a5.1 5.1 0 0 1-.797 2.74l3.537 3.535.076.087a1.125 1.125 0 0 1-1.582 1.582l-.087-.078-3.536-3.536a5.1 5.1 0 0 1-2.736.795 5.1 5.1 0 0 1-2.74-.795l-3.536 3.536a1.125 1.125 0 1 1-1.59-1.59l3.534-3.537a5.1 5.1 0 0 1-.792-2.74c0-1.007.29-1.947.792-2.74L4.134 5.724l-.078-.085a1.125 1.125 0 0 1 1.583-1.583l.085.078L9.26 7.668A5.1 5.1 0 0 1 12 6.874a5.1 5.1 0 0 1 2.737.794l3.536-3.534.087-.078a1.126 1.126 0 0 1 1.505 1.668l-3.536 3.534A5.1 5.1 0 0 1 17.125 12"
      />
      <path
        fill={color}
        d="M20.875 12a8.875 8.875 0 1 0-17.75 0 8.875 8.875 0 0 0 17.75 0m2.25 0c0 6.144-4.98 11.124-11.124 11.125S.875 18.145.875 12 5.856.875 12.001.875c6.143 0 11.124 4.981 11.124 11.126Z"
      />
    </svg>
  );
}
