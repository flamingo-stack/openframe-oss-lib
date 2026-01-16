import type { SVGProps } from "react";
export interface SkullIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function SkullIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: SkullIconProps) {
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
        d="M8.875 22v-3a1.125 1.125 0 0 1 2.25 0v3a1.126 1.126 0 0 1-2.25 0m4 0v-3a1.125 1.125 0 0 1 2.25 0v3a1.125 1.125 0 0 1-2.25 0m-3.5-10.75a1.125 1.125 0 1 0-2.25 0 1.125 1.125 0 0 0 2.25 0m7.5 0a1.125 1.125 0 1 0-2.25 0 1.125 1.125 0 0 0 2.25 0m-5.25 0a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0m7.5 0a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0"
      />
      <path
        fill={color}
        d="M19.875 11a7.875 7.875 0 0 0-7.47-7.865L12 3.125A7.875 7.875 0 0 0 4.125 11v2.62c0 .548.24 1.068.655 1.424l2.452 2.102c.25.214.393.526.393.854v2c0 .483.392.875.875.875h7a.875.875 0 0 0 .875-.875v-2c0-.328.144-.64.393-.854l2.452-2.102c.416-.356.655-.876.655-1.423zm2.25 2.62a4.13 4.13 0 0 1-1.44 3.132l-2.06 1.766V20c0 1.726-1.4 3.125-3.126 3.125H8.5A3.125 3.125 0 0 1 5.375 20v-1.484l-2.06-1.764a4.13 4.13 0 0 1-1.44-3.131V11C1.875 5.408 6.408.875 12 .875l.521.013c5.35.272 9.604 4.695 9.604 10.112z"
      />
    </svg>
  );
}
