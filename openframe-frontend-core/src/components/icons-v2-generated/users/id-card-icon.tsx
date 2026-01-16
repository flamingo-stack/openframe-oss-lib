import type { SVGProps } from "react";
export interface IdCardIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function IdCardIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: IdCardIconProps) {
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
        d="M20.875 7c0-1.036-.84-1.875-1.875-1.875H5c-1.036 0-1.875.84-1.875 1.875v10c0 1.036.84 1.875 1.875 1.875h14c1.035 0 1.874-.84 1.875-1.875zm2.25 10A4.125 4.125 0 0 1 19 21.125H5A4.125 4.125 0 0 1 .875 17V7A4.125 4.125 0 0 1 5 2.875h14A4.125 4.125 0 0 1 23.125 7z"
      />
      <path
        fill={color}
        d="M11.124 16.5c0-.76-.614-1.375-1.374-1.376h-1.5c-.759 0-1.375.617-1.375 1.376a1.125 1.125 0 0 1-2.25 0 3.626 3.626 0 0 1 3.625-3.626h1.5a3.625 3.625 0 0 1 3.624 3.626 1.125 1.125 0 0 1-2.25 0M18 11.876l.115.005a1.126 1.126 0 0 1 0 2.239l-.114.006H15.5a1.125 1.125 0 0 1 0-2.25zM9.75 9.375a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0m8.25-1.5.115.006a1.125 1.125 0 0 1 0 2.238l-.114.006H15.5a1.125 1.125 0 0 1 0-2.25zm-6 1.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0"
      />
    </svg>
  );
}
