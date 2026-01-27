import type { SVGProps } from "react";
export interface ShapeHexagonIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ShapeHexagonIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ShapeHexagonIconProps) {
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
        d="M15.508 1.875c1.47 0 2.827.781 3.566 2.05l3.49 6a4.13 4.13 0 0 1 0 4.15l-3.49 6a4.13 4.13 0 0 1-3.566 2.05H8.49a4.13 4.13 0 0 1-3.566-2.05l-3.49-6a4.13 4.13 0 0 1 0-4.15l3.49-6a4.13 4.13 0 0 1 3.566-2.05zM8.49 4.125c-.667 0-1.285.355-1.621.932l-3.49 6a1.88 1.88 0 0 0 0 1.886l3.49 6c.336.577.954.932 1.621.932h7.018c.668 0 1.285-.355 1.62-.932l3.491-6a1.88 1.88 0 0 0 0-1.886l-3.49-6a1.88 1.88 0 0 0-1.62-.932z"
      />
    </svg>
  );
}
