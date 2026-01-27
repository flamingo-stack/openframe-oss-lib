import type { SVGProps } from "react";
export interface TiktokIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function TiktokIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: TiktokIconProps) {
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
        d="M5.875 16a4.12 4.12 0 0 1 3-3.966v-.778A4.876 4.876 0 0 0 10 20.875a4.875 4.875 0 0 0 4.875-4.876V7.745a1.126 1.126 0 0 1 1.768-.923 5.8 5.8 0 0 0 2.232.94V7a5.13 5.13 0 0 1-3.874-3.875h-.876v12.874a4.125 4.125 0 1 1-8.25 0Zm11.25 0A7.125 7.125 0 1 1 10 8.874c.621 0 1.125.503 1.125 1.125v3c0 .62-.504 1.124-1.125 1.124A1.875 1.875 0 1 0 11.875 16V2l.006-.116A1.125 1.125 0 0 1 13 .875h3c.621 0 1.125.504 1.125 1.125A2.876 2.876 0 0 0 20 4.875c.622 0 1.125.504 1.125 1.125v3c0 .621-.504 1.125-1.125 1.126a8.1 8.1 0 0 1-2.875-.526z"
      />
    </svg>
  );
}
