import type { SVGProps } from "react";
export interface Numer4SquareIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Numer4SquareIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: Numer4SquareIconProps) {
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
        d="M12.126 16v-.626H9.5a1.374 1.374 0 0 1-1.174-2.088l3.5-5.75.149-.204c.796-.916 2.4-.384 2.4.919v4.873h.376l.115.006a1.126 1.126 0 0 1 0 2.24l-.115.004h-.375V16a1.125 1.125 0 0 1-2.25 0m-1.068-2.876h1.068v-1.753z"
      />
    </svg>
  );
}
