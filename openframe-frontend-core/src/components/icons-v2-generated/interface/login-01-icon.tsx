import type { SVGProps } from "react";
export interface Login01IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Login01Icon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Login01IconProps) {
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
        d="M19.875 18V6c0-1.035-.84-1.875-1.875-1.875h-4a1.125 1.125 0 0 1 0-2.25h4A4.125 4.125 0 0 1 22.125 6v12A4.125 4.125 0 0 1 18 22.125h-4a1.125 1.125 0 0 1 0-2.25h4c1.036 0 1.875-.84 1.875-1.875"
      />
      <path
        fill={color}
        d="M7.204 17.795a1.126 1.126 0 0 0 1.506.078l.085-.078 5-5a1.126 1.126 0 0 0 0-1.59l-5-5a1.125 1.125 0 0 0-1.59 1.59l3.08 3.08H3a1.125 1.125 0 0 0 0 2.25h7.285l-3.08 3.08-.077.085a1.125 1.125 0 0 0 .076 1.505"
      />
    </svg>
  );
}
