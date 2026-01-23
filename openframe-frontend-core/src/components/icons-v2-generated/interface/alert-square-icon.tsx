import type { SVGProps } from "react";
export interface AlertSquareIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AlertSquareIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: AlertSquareIconProps) {
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
        d="M19.875 6c0-1.036-.84-1.875-1.875-1.875H6c-1.036 0-1.875.84-1.875 1.875v12c0 1.035.84 1.875 1.875 1.875h12c1.035 0 1.875-.84 1.875-1.875zm2.25 12A4.125 4.125 0 0 1 18 22.125H6A4.125 4.125 0 0 1 1.875 18V6A4.125 4.125 0 0 1 6 1.875h12A4.125 4.125 0 0 1 22.125 6z"
      />
      <path
        fill={color}
        d="M10.876 12V8a1.125 1.125 0 0 1 2.25 0v4a1.126 1.126 0 0 1-2.25 0m2.498 4a1.375 1.375 0 0 1-2.742.14l-.007-.14.007-.141a1.375 1.375 0 0 1 1.369-1.233l.14.007c.693.07 1.233.655 1.233 1.367"
      />
    </svg>
  );
}
