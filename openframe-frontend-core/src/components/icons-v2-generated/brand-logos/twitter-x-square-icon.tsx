import type { SVGProps } from "react";
export interface TwitterXSquareIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function TwitterXSquareIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: TwitterXSquareIconProps) {
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
        d="m10.5 5.875.142.009c.325.041.62.223.8.502l1.804 2.775 2.96-2.956a1.125 1.125 0 0 1 1.59 1.59l-3.297 3.295 3.445 5.297A1.126 1.126 0 0 1 17 18.125h-3.5c-.381 0-.736-.193-.944-.512l-1.804-2.776-2.957 2.959a1.125 1.125 0 0 1-1.59-1.59l3.293-3.297-3.441-5.295A1.126 1.126 0 0 1 7 5.875zm3.61 10h.818l-5.04-7.75h-.815z"
      />
    </svg>
  );
}
