import type { SVGProps } from "react";
export interface LampDeskIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function LampDeskIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: LampDeskIconProps) {
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
        d="M9.036 6.745a1.125 1.125 0 0 1 1.612 1.57l-3.455 3.546a1.88 1.88 0 0 0-.385 2.036l2.939 6.978H14l.114.006a1.126 1.126 0 0 1 0 2.238l-.114.006H4a1.125 1.125 0 0 1 0-2.25h3.305l-2.57-6.105a4.13 4.13 0 0 1 .847-4.48z"
      />
      <path
        fill={color}
        d="M8.414 2.034a3.955 3.955 0 0 1 5.591 0l1.671 1.671h3.827c1.447 0 2.173 1.75 1.15 2.775l-7.793 7.793c-1.024 1.023-2.775.297-2.775-1.15V9.296l-1.671-1.67a3.954 3.954 0 0 1 0-5.592m4 1.592a1.702 1.702 0 1 0-2.408 2.408l2 2c.21.21.33.498.33.797v2.783l5.658-5.659H15.21c-.299 0-.586-.118-.797-.33z"
      />
    </svg>
  );
}
