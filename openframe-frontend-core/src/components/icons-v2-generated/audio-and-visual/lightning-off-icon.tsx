import type { SVGProps } from "react";
export interface LightningOffIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function LightningOffIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: LightningOffIconProps) {
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
        d="M19.997 8.375c1.282 0 2.027 1.392 1.407 2.442l-.142.205-1.982 2.45a1.125 1.125 0 0 1-1.75-1.416l1.158-1.431h-3.546a1.125 1.125 0 0 1 0-2.25zM14.34 7.71a1.125 1.125 0 0 1-2.236-.26zm-2.2-6.341c1.016-1.063 2.838-.298 2.79 1.172l-.011.149-.58 5.02-1.118-.13-1.118-.13.333-2.88-.92 1.138a1.125 1.125 0 1 1-1.749-1.415l2.275-2.812zM1.204 1.205a1.125 1.125 0 0 1 1.506-.078l.085.078 20 20 .077.086a1.124 1.124 0 0 1-1.582 1.582l-.086-.078-5.234-5.234-4.01 4.959c-1.024 1.264-3.066.406-2.88-1.21l.658-5.685H4.002c-1.366 0-2.122-1.585-1.263-2.647l3.868-4.78-5.403-5.402-.077-.085a1.125 1.125 0 0 1 .077-1.506m4.108 12.17h5.127c.91 0 1.63.744 1.626 1.631l-.012.18-.49 4.244 2.807-3.469-6.164-6.164z"
      />
    </svg>
  );
}
