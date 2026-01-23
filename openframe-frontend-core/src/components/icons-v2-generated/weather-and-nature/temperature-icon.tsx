import type { SVGProps } from "react";
export interface TemperatureIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function TemperatureIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: TemperatureIconProps) {
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
        d="M13.376 5.5a2.376 2.376 0 0 0-4.751 0v7.51c0 .512-.186.963-.445 1.315l-.116.145A3.875 3.875 0 1 0 14.876 17a3.85 3.85 0 0 0-.732-2.266l-.209-.264a2.24 2.24 0 0 1-.56-1.46zm2.25 7.482.013.019.17.205a6.125 6.125 0 1 1-9.448-.205l.014-.02V5.5a4.625 4.625 0 0 1 9.25 0z"
      />
      <path
        fill={color}
        d="M9.875 11a1.125 1.125 0 0 1 2.25 0v4.198a2.125 2.125 0 1 1-2.25 0zM20 9.875l.115.006a1.125 1.125 0 0 1 0 2.238l-.114.006h-2.002a1.125 1.125 0 0 1 0-2.25zm0-3 .115.006a1.125 1.125 0 0 1 0 2.238L20 9.125h-2.002a1.125 1.125 0 0 1 0-2.25zm0-3 .115.006a1.125 1.125 0 0 1 0 2.238L20 6.125h-2.002a1.125 1.125 0 0 1 0-2.25z"
      />
    </svg>
  );
}
