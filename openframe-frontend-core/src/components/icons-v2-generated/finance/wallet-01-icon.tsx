import type { SVGProps } from "react";
export interface Wallet01IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Wallet01Icon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: Wallet01IconProps) {
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
        d="M19.875 9V6c0-1.036-.84-1.875-1.875-1.875H6c-1.036 0-1.875.84-1.875 1.875v12c0 1.035.84 1.875 1.875 1.875h12c1.035 0 1.875-.84 1.875-1.875v-3a1.125 1.125 0 0 1 2.25 0v3A4.125 4.125 0 0 1 18 22.125H6A4.125 4.125 0 0 1 1.875 18V6A4.125 4.125 0 0 1 6 1.875h12A4.125 4.125 0 0 1 22.125 6v3a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M16.375 12a1.376 1.376 0 0 1-2.743.14l-.008-.14.008-.14A1.376 1.376 0 0 1 15 10.623l.14.008c.694.07 1.235.656 1.235 1.368Zm-3.25 0c0 1.036.84 1.875 1.875 1.875h5.875v-3.75H15c-1.036 0-1.875.84-1.875 1.875m10 2A2.126 2.126 0 0 1 21 16.124h-6a4.125 4.125 0 1 1 0-8.25h6c1.174 0 2.125.952 2.125 2.126v3.998Z"
      />
    </svg>
  );
}
