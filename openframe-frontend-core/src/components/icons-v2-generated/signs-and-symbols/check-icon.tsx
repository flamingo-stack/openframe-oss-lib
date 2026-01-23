import type { SVGProps } from "react";
export interface CheckIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CheckIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: CheckIconProps) {
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
        d="M19.281 5.139a1.125 1.125 0 0 1 1.522 1.654L10.164 17.64a1.626 1.626 0 0 1-2.333-.014l-4.643-4.844-.076-.086a1.125 1.125 0 0 1 1.616-1.548l.084.079 4.196 4.377L19.196 5.216z"
      />
    </svg>
  );
}
