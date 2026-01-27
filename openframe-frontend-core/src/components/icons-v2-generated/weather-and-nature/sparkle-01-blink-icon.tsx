import type { SVGProps } from "react";
export interface Sparkle01BlinkIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Sparkle01BlinkIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: Sparkle01BlinkIconProps) {
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
        d="M4.705 17.704a1.125 1.125 0 0 1 1.59 1.59l-2.5 2.501a1.125 1.125 0 1 1-1.59-1.59zm13 0a1.125 1.125 0 0 1 1.505-.076l.085.076 2.5 2.5.078.085a1.126 1.126 0 0 1-1.583 1.584l-.085-.078-2.5-2.5-.077-.085a1.125 1.125 0 0 1 .076-1.506Zm-15.5-15.5a1.125 1.125 0 0 1 1.505-.077l.085.077 2.5 2.501.077.085A1.125 1.125 0 0 1 4.79 6.372l-.085-.076-2.5-2.5-.078-.086a1.125 1.125 0 0 1 .078-1.506m18 0a1.125 1.125 0 1 1 1.59 1.591l-2.5 2.5a1.125 1.125 0 0 1-1.59-1.59l2.5-2.5Z"
      />
      <path
        fill={color}
        d="M10.605 1.66c.617-1.05 2.172-1.05 2.79 0l.117.241 2.428 6.158 6.158 2.429c1.372.54 1.372 2.482 0 3.023l-6.158 2.43-2.428 6.157c-.542 1.372-2.483 1.372-3.024 0L8.06 15.94l-6.158-2.429c-1.371-.54-1.371-2.482 0-3.023L8.06 8.059l2.43-6.158zm-.631 7.68c-.114.29-.344.52-.634.634L4.2 12l5.14 2.027.105.048c.24.125.429.331.529.585L12 19.797l2.027-5.137.049-.106a1.12 1.12 0 0 1 .584-.527L19.797 12 14.66 9.974a1.13 1.13 0 0 1-.633-.635L12 4.201z"
      />
    </svg>
  );
}
