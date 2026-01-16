import type { SVGProps } from "react";
export interface FramerIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function FramerIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: FramerIconProps) {
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
        d="M4.875 14.378V14a1.125 1.125 0 0 1 2.25 0v.378c0 .1.04.195.11.265l3.64 3.64v-3.282a1.125 1.125 0 0 1 2.25 0v6a1.125 1.125 0 0 1-1.92.795l-5.561-5.56a2.63 2.63 0 0 1-.769-1.858"
      />
      <path
        fill={color}
        d="M7.125 13.875h8.16l-3.75-3.75h-4.41zm5.34-6h4.41v-3.75h-8.16zm6.66.125A2.126 2.126 0 0 1 17 10.125h-2.284l4.08 4.08a1.125 1.125 0 0 1-.796 1.92H7A2.125 2.125 0 0 1 4.875 14v-4c0-1.173.952-2.125 2.125-2.125h2.284l-4.08-4.08A1.126 1.126 0 0 1 6 1.875h11c1.173 0 2.125.952 2.125 2.125z"
      />
    </svg>
  );
}
