import type { SVGProps } from "react";
export interface ExpandSquareIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ExpandSquareIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: ExpandSquareIconProps) {
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
        d="M9.204 13.205a1.125 1.125 0 0 1 1.59 1.59l-1.578 1.58H10l.115.005a1.125 1.125 0 0 1 0 2.239l-.115.006H6.5A1.125 1.125 0 0 1 5.375 17.5V14a1.125 1.125 0 0 1 2.25 0v.784zM18.624 10a1.125 1.125 0 0 1-2.25 0v-.784l-1.579 1.579a1.125 1.125 0 1 1-1.59-1.59l1.579-1.58H14a1.125 1.125 0 0 1 0-2.25h3.5c.62 0 1.125.504 1.125 1.125V10Z"
      />
    </svg>
  );
}
