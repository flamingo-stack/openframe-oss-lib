import type { SVGProps } from "react";
export interface MixerIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function MixerIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: MixerIconProps) {
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
        d="M1.875 22V9a1.125 1.125 0 0 1 2.25 0v13a1.125 1.125 0 0 1-2.25 0m5-6V9a1.126 1.126 0 0 1 2.25 0v7a4.876 4.876 0 0 0 4.624 4.87l.25.005.116.006a1.125 1.125 0 0 1 0 2.238l-.116.006-.366-.009A7.126 7.126 0 0 1 6.875 16m9.5-2v-2.875H15A1.125 1.125 0 0 1 13.875 10V9a1.125 1.125 0 0 1 2.243-.125h2.764A1.126 1.126 0 0 1 21.124 9v1c0 .621-.503 1.125-1.124 1.125h-1.375v2.876a1.126 1.126 0 0 1-2.25 0ZM5.51 4.376l.116.006a1.124 1.124 0 0 1 0 2.238l-.116.006H5.5a1.125 1.125 0 0 1 0-2.25zm16.46 0 .115.006a1.126 1.126 0 0 1 0 2.238l-.114.006H12a1.125 1.125 0 0 1 0-2.25z"
      />
      <path
        fill={color}
        d="M20.875 15.125h-6.75V17.5a3.375 3.375 0 0 0 6.75 0zm2.25 2.375A5.6 5.6 0 0 1 22 20.875l.115.005a1.125 1.125 0 0 1 0 2.239l-.115.006H2a1.125 1.125 0 0 1 0-2.25h11a5.6 5.6 0 0 1-1.126-3.375V15c0-1.173.952-2.125 2.126-2.125h7c1.174 0 2.125.952 2.125 2.126zm0-9.5A2.127 2.127 0 0 1 21 10.126H3A2.126 2.126 0 0 1 .875 8V4A3.125 3.125 0 0 1 4 .875h14A5.125 5.125 0 0 1 23.125 6zm-20-.125h17.75V6A2.875 2.875 0 0 0 18 3.125H4A.875.875 0 0 0 3.125 4z"
      />
    </svg>
  );
}
