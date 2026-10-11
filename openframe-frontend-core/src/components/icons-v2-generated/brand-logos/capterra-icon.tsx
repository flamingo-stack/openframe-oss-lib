import type { SVGProps } from "react";
export interface CapterraIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CapterraIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: CapterraIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="4.978 2.022 320.044 325.956"
      width={size}
      height={size}
      className={className}
      {...props}
    >
      <path fill="#ff9d28" d="m4.978 121.868 135.18.027 82.2.014V40.475z" />
      <path fill="#68c5ed" d="M222.357 40.475v287.503L325.022 2.022z" />
      <path fill="#044d80" d="m222.357 121.909-82.199-.014 82.2 206.083z" />
      <path fill="#e54747" d="m4.978 121.868 156.26 52.905-21.08-52.878z" />
    </svg>
  );
}
