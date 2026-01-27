import type { SVGProps } from "react";
export interface Pen01IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Pen01Icon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: Pen01IconProps) {
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
        d="M12.704 4.705a1.125 1.125 0 0 1 1.506-.078l.085.078 5 5 .077.085a1.124 1.124 0 0 1-1.582 1.583l-.086-.078-5-5-.077-.085a1.126 1.126 0 0 1 .077-1.505"
      />
      <path
        fill={color}
        d="M15.5 1.817a4.2 4.2 0 0 1 5.619.288l.776.775.287.32a4.2 4.2 0 0 1-.287 5.62L9.42 21.295a4.2 4.2 0 0 1-1.958 1.107l-.321.066-3.762.627a2.15 2.15 0 0 1-2.474-2.474l.627-3.762a4.2 4.2 0 0 1 1.173-2.278L15.18 2.105zm4.028 1.88a1.95 1.95 0 0 0-2.757 0L4.295 16.171a1.95 1.95 0 0 0-.545 1.058l-.605 3.622 3.624-.603.15-.03a1.97 1.97 0 0 0 .91-.515L20.304 7.228a1.95 1.95 0 0 0 .133-2.607l-.133-.148-.777-.777Z"
      />
    </svg>
  );
}
