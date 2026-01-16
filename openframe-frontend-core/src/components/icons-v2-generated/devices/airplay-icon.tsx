import type { SVGProps } from "react";
export interface AirplayIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AirplayIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: AirplayIconProps) {
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
        d="M19.875 14V6c0-1.036-.84-1.875-1.875-1.875H6c-1.036 0-1.875.84-1.875 1.875v8c0 .945.7 1.728 1.61 1.857l.184.016.115.01a1.126 1.126 0 0 1-.094 2.237l-.114.002-.408-.037a4.13 4.13 0 0 1-3.543-4.086V6A4.125 4.125 0 0 1 6 1.875h12A4.125 4.125 0 0 1 22.125 6v8c0 2.22-1.753 4.03-3.95 4.122l-.115-.002a1.125 1.125 0 0 1 .02-2.247l.185-.016A1.876 1.876 0 0 0 19.875 14"
      />
      <path
        fill={color}
        d="M10.53 15.505a2.03 2.03 0 0 1 2.94 0l.159.192 2.662 3.66c.903 1.243-.106 2.767-1.45 2.767H9.159c-1.343 0-2.353-1.524-1.45-2.767l2.663-3.66zm-.415 4.37h3.77L12 17.281l-1.885 2.592Z"
      />
    </svg>
  );
}
