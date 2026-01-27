import type { SVGProps } from "react";
export interface BracketSquareEllipsisVrIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function BracketSquareEllipsisVrIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: BracketSquareEllipsisVrIconProps) {
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
        d="M1.875 18V6A4.125 4.125 0 0 1 6 1.875h2l.115.006a1.125 1.125 0 0 1 0 2.238L8 4.125H6c-1.036 0-1.875.84-1.875 1.875v12c0 1.035.84 1.875 1.875 1.875h2l.115.006a1.125 1.125 0 0 1 0 2.238L8 22.125H6A4.125 4.125 0 0 1 1.875 18m18 0V6c0-1.036-.84-1.875-1.875-1.875h-2a1.125 1.125 0 0 1 0-2.25h2A4.125 4.125 0 0 1 22.125 6v12A4.125 4.125 0 0 1 18 22.125h-2a1.125 1.125 0 0 1 0-2.25h2c1.035 0 1.875-.84 1.875-1.875M11.5 16.129a.62.62 0 0 0-.124.37l.011.127c.019.09.06.172.113.244zm1 .741a.6.6 0 0 0 .112-.245l.013-.125-.013-.127a.6.6 0 0 0-.111-.244zm-1-5.241a.62.62 0 0 0-.124.37l.011.127c.019.09.06.172.113.244zm1 .741a.6.6 0 0 0 .112-.244l.013-.127-.013-.126a.6.6 0 0 0-.111-.244zm-.334-6.486a1.625 1.625 0 1 1-1.782 1.782l-.009-.166.009-.166a1.625 1.625 0 0 1 1.615-1.459zM11.63 8a.62.62 0 0 0 .743 0zM12 6.875a.62.62 0 0 0-.37.125H12zM12 7h.373a.6.6 0 0 0-.246-.113L12 6.875zm1.627 9.5a1.625 1.625 0 0 1-3.242.167l-.009-.168.009-.165A1.625 1.625 0 0 1 12 14.875l.167.009c.82.083 1.46.774 1.46 1.616m0-4.5a1.625 1.625 0 0 1-3.242.167l-.009-.168.009-.165A1.625 1.625 0 0 1 12 10.375l.167.009c.82.083 1.46.774 1.46 1.615Z"
      />
    </svg>
  );
}
