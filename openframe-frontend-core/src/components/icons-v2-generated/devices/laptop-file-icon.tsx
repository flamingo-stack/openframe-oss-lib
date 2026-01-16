import type { SVGProps } from "react";
export interface LaptopFileIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function LaptopFileIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: LaptopFileIconProps) {
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
        d="M1.875 15V6A4.125 4.125 0 0 1 6 1.875h10a4.13 4.13 0 0 1 3.773 2.455l.117.295.033.11a1.125 1.125 0 0 1-2.11.746l-.044-.106-.118-.263a1.88 1.88 0 0 0-1.65-.987H6c-1.036 0-1.875.84-1.875 1.875v9a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M11.874 19.5v-9A2.625 2.625 0 0 1 14.5 7.875h3.38c.696 0 1.364.277 1.856.769l2.62 2.62.176.194c.383.467.593 1.054.594 1.663V19.5a2.625 2.625 0 0 1-2.625 2.625h-6a2.625 2.625 0 0 1-2.626-2.625ZM8 13.875l.221.022c.216.043.416.15.574.308l1 1A1.126 1.126 0 0 1 9 17.125H2A1.125 1.125 0 0 1 .875 16v-1c0-.621.504-1.125 1.125-1.125zm6.124 5.625c0 .207.169.375.375.375h6a.375.375 0 0 0 .376-.375v-5.876H19A1.625 1.625 0 0 1 17.375 12v-1.875h-2.876a.375.375 0 0 0-.375.375z"
      />
    </svg>
  );
}
