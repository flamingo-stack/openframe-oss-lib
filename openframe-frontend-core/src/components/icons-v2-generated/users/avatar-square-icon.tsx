import type { SVGProps } from "react";
export interface AvatarSquareIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AvatarSquareIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: AvatarSquareIconProps) {
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
        d="M5.132 21.052A1.125 1.125 0 0 1 3.3 19.744l1.83 1.308Zm8.78-5.676a7.13 7.13 0 0 1 5.798 2.983l.99 1.385a1.125 1.125 0 0 1-1.831 1.308l-.99-1.386a4.88 4.88 0 0 0-3.967-2.04h-3.825A4.87 4.87 0 0 0 6.3 19.432l-.179.233-.988 1.386-.916-.655-.916-.653.99-1.385.26-.342a7.13 7.13 0 0 1 5.537-2.641h3.825Zm.214-5.626a2.126 2.126 0 0 0-4.251 0 2.125 2.125 0 0 0 4.25 0Zm2.25 0a4.375 4.375 0 1 1-8.75-.002 4.375 4.375 0 0 1 8.75.002"
      />
      <path
        fill={color}
        d="M19.875 6c0-1.036-.84-1.875-1.875-1.875H6c-1.036 0-1.875.84-1.875 1.875v12c0 1.035.84 1.875 1.875 1.875h12c1.035 0 1.875-.84 1.875-1.875zm2.25 12A4.125 4.125 0 0 1 18 22.125H6A4.125 4.125 0 0 1 1.875 18V6A4.125 4.125 0 0 1 6 1.875h12A4.125 4.125 0 0 1 22.125 6z"
      />
    </svg>
  );
}
