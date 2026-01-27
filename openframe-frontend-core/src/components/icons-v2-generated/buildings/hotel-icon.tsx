import type { SVGProps } from "react";
export interface HotelIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function HotelIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: HotelIconProps) {
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
        d="M17.875 21V4.125H6.125V21a1.125 1.125 0 0 1-2.25 0V4.118A1.125 1.125 0 0 1 4 1.875h16l.115.006a1.124 1.124 0 0 1 .01 2.235V21a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M12.876 17a.876.876 0 1 0-1.75 0v2.875h1.75zM10 9.875l.116.006a1.125 1.125 0 0 1 0 2.239l-.116.006H9a1.126 1.126 0 0 1 0-2.25h1Zm5 0 .115.006a1.125 1.125 0 0 1 0 2.239l-.116.006h-.998a1.125 1.125 0 0 1 0-2.25h.998Zm-5-4a1.125 1.125 0 0 1 0 2.25H9a1.125 1.125 0 0 1 0-2.25zm5 0 .115.006a1.125 1.125 0 0 1 0 2.238L15 8.125h-.998a1.125 1.125 0 0 1 0-2.25zm.126 14H20l.115.005a1.126 1.126 0 0 1 0 2.239l-.114.006H4a1.125 1.125 0 0 1 0-2.25h4.875V17a3.126 3.126 0 1 1 6.25 0z"
      />
    </svg>
  );
}
