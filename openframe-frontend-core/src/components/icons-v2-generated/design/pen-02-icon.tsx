import type { SVGProps } from "react";
export interface Pen02IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Pen02Icon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Pen02IconProps) {
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
        d="M9.027 3.404a3.126 3.126 0 0 1 4.182.215l6.087 6.085a1.127 1.127 0 0 1-1.591 1.592L11.618 5.21a.876.876 0 0 0-1.1-.113l-.137.113-4.086 4.085a1.125 1.125 0 1 1-1.59-1.59L8.79 3.618z"
      />
      <path
        fill={color}
        d="M15.5 1.817a4.2 4.2 0 0 1 5.619.288l.776.775.287.32a4.2 4.2 0 0 1-.287 5.62L9.42 21.295a4.2 4.2 0 0 1-1.958 1.107l-.321.066-3.762.627a2.15 2.15 0 0 1-2.474-2.474l.627-3.762a4.2 4.2 0 0 1 1.173-2.278L15.18 2.105zm4.028 1.88a1.95 1.95 0 0 0-2.757 0L4.295 16.171a1.95 1.95 0 0 0-.545 1.058l-.605 3.622 3.624-.603.15-.03a1.97 1.97 0 0 0 .91-.515L20.304 7.228a1.95 1.95 0 0 0 .133-2.607l-.133-.148-.777-.777Z"
      />
    </svg>
  );
}
