import type { SVGProps } from "react";
export interface OsqueryLogoIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function OsqueryLogoIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: OsqueryLogoIconProps) {
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
      <path fill="#A596FF" d="M21.99 2v5.025l-4.995 5.015V7.004z" />
      <path fill="#000" d="M12 2v5.025l4.995 5.015V7.004z" />
      <path fill="#A596FF" d="M22 22.07h-5.005L12 17.055h5.016z" />
      <path fill="#000" d="M22 12.04h-5.005L12 17.055h5.016z" />
      <path fill="#A596FF" d="M2.01 22.08v-5.025l4.995-5.015v5.036z" />
      <path fill="#000" d="M12 22.08v-5.025L7.005 12.04v5.036z" />
      <path fill="#A596FF" d="M2 2.01h5.005L12 7.025H6.985z" />
      <path fill="#000" d="M2 12.04h5.005L12 7.025H6.985z" />
    </svg>
  );
}
