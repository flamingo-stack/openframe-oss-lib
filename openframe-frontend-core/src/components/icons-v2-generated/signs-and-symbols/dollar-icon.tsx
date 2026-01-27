import type { SVGProps } from "react";
export interface DollarIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function DollarIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: DollarIconProps) {
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
        d="M10.875 22v-2a1.125 1.125 0 1 1 2.25 0v2a1.125 1.125 0 0 1-2.25 0m0-18V2a1.125 1.125 0 1 1 2.25 0v2a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M7.146 15.933a1.125 1.125 0 0 1 1.422.712l-2.134.71a1.125 1.125 0 0 1 .712-1.422m1.479-8.165c.002.717.292 1.203.848 1.608.616.448 1.553.782 2.748 1.021 2.753.55 5.404 2.293 5.404 5.352 0 3.03-2.56 5.376-5.623 5.376-3.02 0-4.928-1.843-5.568-3.77L7.5 17l1.067-.355c.357 1.073 1.451 2.23 3.434 2.23 1.938 0 3.373-1.454 3.373-3.126 0-1.35-1.093-2.52-3.167-3.05l-.43-.096c-1.305-.261-2.619-.674-3.628-1.408-1.066-.776-1.776-1.907-1.775-3.436q0-.052.004-.106c.061-2.82 2.73-4.778 5.623-4.778 2.83 0 4.68 1.621 5.43 3.41l.136.359.03.111a1.126 1.126 0 0 1-2.123.708l-.043-.107-.075-.202c-.422-1.013-1.498-2.029-3.355-2.029-2.077 0-3.375 1.356-3.376 2.625z"
      />
    </svg>
  );
}
