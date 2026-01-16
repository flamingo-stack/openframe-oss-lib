import type { SVGProps } from "react";
export interface CastleIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CastleIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: CastleIconProps) {
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
        d="M18.342 3.087c.294-.211.67-.27 1.014-.155l3 1a1.126 1.126 0 0 1 0 2.135l-2.231.743v4.08l1.977 9.89a1.124 1.124 0 1 1-2.206.44l-1.817-9.094H7.375a1.125 1.125 0 0 1 0-2.25h2.5V9a1.125 1.125 0 0 1 2.25 0v.876h1.75V9a1.126 1.126 0 0 1 2.25 0v.876h1.75V4l.007-.135a1.13 1.13 0 0 1 .46-.778"
      />
      <path
        fill={color}
        d="M13.876 18a.875.875 0 0 0-1.751 0v1.875h1.75zm-9.679 1.875h2.606L5.94 6.125h-.882l-.86 13.75Zm11.928 0H22a1.125 1.125 0 0 1 0 2.25H2a1.125 1.125 0 0 1-.057-2.248l.882-14.11a2.1 2.1 0 0 1-.636-.656l-.082-.147a2.1 2.1 0 0 1-.214-.816c-.018-.223-.018-.487-.018-.748V3a1.125 1.125 0 0 1 2.25 0v.4c0 .22.002.363.006.467.105.004.248.008.47.008h1.8c.219 0 .361-.004.465-.008.004-.104.009-.247.009-.467V3a1.125 1.125 0 0 1 2.25 0v.4c0 .261 0 .525-.018.748a2.3 2.3 0 0 1-.12.6l-.093.216a2.1 2.1 0 0 1-.723.806l.885 14.105h.819V18a3.125 3.125 0 0 1 6.25 0z"
      />
    </svg>
  );
}
