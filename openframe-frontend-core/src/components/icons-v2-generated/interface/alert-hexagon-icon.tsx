import type { SVGProps } from "react";
export interface AlertHexagonIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AlertHexagonIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: AlertHexagonIconProps) {
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
        d="M10.876 12V8a1.125 1.125 0 0 1 2.25 0v4a1.126 1.126 0 0 1-2.25 0m2.498 4a1.375 1.375 0 0 1-2.742.14l-.007-.14.007-.141a1.375 1.375 0 0 1 1.369-1.233l.14.007c.693.07 1.233.655 1.233 1.367"
      />
    </svg>
  );
}
