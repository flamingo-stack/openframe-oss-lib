import type { SVGProps } from "react";
export interface BitcoinCircleIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function BitcoinCircleIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: BitcoinCircleIconProps) {
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
        d="M14 14.188c0-.932-.755-1.688-1.688-1.688h-1.687v3.376h1.688c.931 0 1.687-.756 1.687-1.688m-.626-5.001c0-.587-.475-1.062-1.062-1.062h-1.687v2.126h1.688l.213-.022c.485-.1.848-.528.848-1.042m2.25 0c0 .774-.267 1.484-.711 2.048a3.93 3.93 0 0 1 1.337 2.953 3.93 3.93 0 0 1-2.625 3.707v.605a1.125 1.125 0 0 1-2.25 0v-.375h-.25v.375a1.125 1.125 0 0 1-2.25 0v-.725a1.43 1.43 0 0 1-.5-1.088V7.312c0-.435.194-.825.5-1.088V5.5a1.125 1.125 0 0 1 2.25 0v.375h.25V5.5a1.125 1.125 0 0 1 2.25 0v.646c1.176.508 2 1.678 2 3.041Z"
      />
    </svg>
  );
}
