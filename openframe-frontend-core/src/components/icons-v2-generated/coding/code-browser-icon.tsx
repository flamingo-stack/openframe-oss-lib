import type { SVGProps } from "react";
export interface CodeBrowserIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CodeBrowserIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: CodeBrowserIconProps) {
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
        d="M9.205 11.955a1.125 1.125 0 0 1 1.59 1.59L9.342 15l1.455 1.455.076.085a1.125 1.125 0 0 1-1.582 1.583l-.085-.078-2.25-2.25a1.125 1.125 0 0 1 0-1.59zm4 0a1.126 1.126 0 0 1 1.505-.078l.085.078 2.25 2.25a1.125 1.125 0 0 1 0 1.59l-2.25 2.25a1.125 1.125 0 0 1-1.59-1.59L14.658 15l-1.455-1.455-.076-.085a1.125 1.125 0 0 1 .076-1.505ZM21 7.875a1.125 1.125 0 0 1 0 2.25H3a1.125 1.125 0 0 1 0-2.25z"
      />
      <path
        fill={color}
        d="M19.875 6c0-1.036-.84-1.875-1.875-1.875H6c-1.036 0-1.875.84-1.875 1.875v12c0 1.035.84 1.875 1.875 1.875h12c1.035 0 1.875-.84 1.875-1.875zm2.25 12A4.125 4.125 0 0 1 18 22.125H6A4.125 4.125 0 0 1 1.875 18V6A4.125 4.125 0 0 1 6 1.875h12A4.125 4.125 0 0 1 22.125 6z"
      />
    </svg>
  );
}
