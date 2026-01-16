import type { SVGProps } from "react";
export interface Settings02LineIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Settings02LineIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Settings02LineIconProps) {
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
        d="M15.509 1.875c1.469 0 2.827.781 3.565 2.05l3.49 6a4.13 4.13 0 0 1 0 4.15l-3.49 6a4.13 4.13 0 0 1-3.565 2.05H8.49a4.13 4.13 0 0 1-3.567-2.05l-3.49-6a4.13 4.13 0 0 1 0-4.15l3.49-6a4.13 4.13 0 0 1 3.567-2.05h7.018ZM8.49 4.125c-.668 0-1.286.355-1.622.932l-3.49 6a1.88 1.88 0 0 0 0 1.886l3.49 6c.336.577.954.932 1.622.932h7.018c.667 0 1.284-.355 1.62-.932l3.49-6a1.88 1.88 0 0 0 0-1.886l-3.49-6a1.88 1.88 0 0 0-1.62-.932z"
      />
      <path
        fill={color}
        d="M12.9 8.326a1.125 1.125 0 0 1 1.864 1.253l-3.599 6a1.126 1.126 0 0 1-1.93-1.158l3.6-6z"
      />
    </svg>
  );
}
