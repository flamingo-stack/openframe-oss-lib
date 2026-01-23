import type { SVGProps } from "react";
export interface CoinsExchangeIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CoinsExchangeIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: CoinsExchangeIconProps) {
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
        d="M20.875 16a4.875 4.875 0 1 0-9.751 0 4.875 4.875 0 0 0 9.75 0Zm-20-8a7.125 7.125 0 0 1 13.86-2.328l.09.273.026.113a1.125 1.125 0 0 1-2.143.644l-.038-.108-.129-.37A4.877 4.877 0 0 0 3.125 8a4.88 4.88 0 0 0 3.098 4.541l.37.129.11.038a1.125 1.125 0 0 1-.645 2.143l-.113-.026-.273-.09A7.13 7.13 0 0 1 .875 8m22.25 8a7.125 7.125 0 1 1-14.25 0 7.125 7.125 0 0 1 14.25 0M1.57 14.96c.42-.173.904-.078 1.225.244l2 2.001.078.085a1.126 1.126 0 0 1-1.625 1.545A2.88 2.88 0 0 0 6 20.875h2l.116.005a1.126 1.126 0 0 1 0 2.239L8 23.125H6A5.125 5.125 0 0 1 .875 18v-2c0-.455.274-.865.694-1.04ZM18 .876A5.125 5.125 0 0 1 23.125 6v2a1.126 1.126 0 0 1-1.92.795l-2-2-.078-.086a1.125 1.125 0 0 1 1.623-1.546A2.875 2.875 0 0 0 18 3.125h-2a1.125 1.125 0 0 1 0-2.25h2Z"
      />
    </svg>
  );
}
