import type { SVGProps } from "react";
export interface Refresh01LeftIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Refresh01LeftIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: Refresh01LeftIconProps) {
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
        d="M19.875 12a7.875 7.875 0 0 1-15.302 2.625 1.125 1.125 0 0 0-2.12.75c1.389 3.93 5.137 6.75 9.547 6.75 5.592 0 10.125-4.533 10.125-10.125S17.592 1.875 12 1.875c-4.45 0-6.84 2.692-8.918 4.915l-.876.914-.001.001-.078.085a1.12 1.12 0 0 0-.248.744q.002.082.015.16l.004.028q.008.03.017.057c.03.12.079.238.15.346l.014.017a1.1 1.1 0 0 0 .286.286l.007.006.008.005c.019.013.04.02.059.031.166.097.357.155.562.155a1.12 1.12 0 0 0 .803-.34C6.485 6.603 8.091 4.126 12 4.126A7.875 7.875 0 0 1 19.875 12"
      />
      <path
        fill={color}
        d="M1.876 3.5v5.001l.022.22a1.126 1.126 0 0 0 1.103.904h5l.114-.006a1.125 1.125 0 0 0 0-2.239l-.116-.005-3.873.001V3.5a1.125 1.125 0 0 0-2.25 0"
      />
    </svg>
  );
}
