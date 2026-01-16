import type { SVGProps } from "react";
export interface ClockPlusIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ClockPlusIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: ClockPlusIconProps) {
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
        d="M20.875 12a8.875 8.875 0 1 0-7.752 8.804 1.126 1.126 0 0 1 .28 2.233q-.69.088-1.402.088C5.856 23.125.875 18.145.875 12S5.856.875 12.001.875c6.143 0 11.124 4.981 11.124 11.126q0 .72-.09 1.419a1.126 1.126 0 0 1-2.232-.284A9 9 0 0 0 20.875 12"
      />
      <path
        fill={color}
        d="M17.875 22v-1.875h-1.876a1.125 1.125 0 0 1 0-2.25h1.876V16a1.125 1.125 0 0 1 2.25 0v1.875H22l.115.006a1.125 1.125 0 0 1 0 2.238l-.115.006h-1.875V22a1.125 1.125 0 0 1-2.25 0m-7-13.5a1.125 1.125 0 0 1 2.25 0v3.034l1.67 1.671.078.085a1.126 1.126 0 0 1-1.582 1.582l-.086-.076-2-2.001a1.13 1.13 0 0 1-.33-.796z"
      />
    </svg>
  );
}
