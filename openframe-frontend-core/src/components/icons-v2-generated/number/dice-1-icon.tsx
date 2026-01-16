import type { SVGProps } from "react";
export interface Dice1IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Dice1Icon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Dice1IconProps) {
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
        d="M19.875 6c0-1.036-.84-1.875-1.875-1.875H6c-1.036 0-1.875.84-1.875 1.875v12c0 1.035.84 1.875 1.875 1.875h12c1.035 0 1.875-.84 1.875-1.875zm2.25 12A4.125 4.125 0 0 1 18 22.125H6A4.125 4.125 0 0 1 1.875 18V6A4.125 4.125 0 0 1 6 1.875h12A4.125 4.125 0 0 1 22.125 6z"
      />
      <path
        fill={color}
        d="M11.5 11.629a.62.62 0 0 0-.124.37l.011.127c.019.09.06.172.113.244zm1 .741a.6.6 0 0 0 .112-.244l.013-.127-.013-.126a.6.6 0 0 0-.111-.244zm1.126-.37a1.625 1.625 0 0 1-3.242.167l-.009-.168.009-.165a1.625 1.625 0 0 1 1.615-1.459l.167.009c.82.083 1.46.774 1.46 1.615Z"
      />
    </svg>
  );
}
