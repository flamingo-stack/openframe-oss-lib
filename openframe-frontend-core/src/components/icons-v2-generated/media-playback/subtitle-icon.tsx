import type { SVGProps } from "react";
export interface SubtitleIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function SubtitleIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: SubtitleIconProps) {
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
        d="M20.875 6c0-1.036-.84-1.875-1.875-1.875H5c-1.036 0-1.875.84-1.875 1.875v10c0 1.036.84 1.875 1.875 1.875h2c.62 0 1.125.504 1.125 1.125v1.77l3.534-2.25a4.13 4.13 0 0 1 2.215-.645H19c1.035 0 1.874-.84 1.875-1.875zm2.25 10A4.125 4.125 0 0 1 19 20.125h-5.126c-.268 0-.531.056-.773.166l-.233.128L9.14 22.79c-1.414.9-3.266-.115-3.266-1.791v-.873H5A4.125 4.125 0 0 1 .875 16V6A4.125 4.125 0 0 1 5 1.875h14A4.125 4.125 0 0 1 23.125 6z"
      />
      <path
        fill={color}
        d="m12 12.876.115.005a1.125 1.125 0 0 1 0 2.239l-.116.006H7a1.125 1.125 0 0 1 0-2.25zm5 0 .115.005a1.126 1.126 0 0 1 0 2.239l-.114.006H16a1.125 1.125 0 0 1 0-2.25zM8 8.875l.115.006a1.126 1.126 0 0 1 0 2.238L8 11.125H7a1.125 1.125 0 0 1 0-2.25zm9 0 .115.006a1.125 1.125 0 0 1 0 2.238l-.114.006h-5.002a1.125 1.125 0 0 1 0-2.25z"
      />
    </svg>
  );
}
