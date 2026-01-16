import type { SVGProps } from "react";
export interface BuildingIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function BuildingIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: BuildingIconProps) {
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
        d="M12.874 21v-4a.875.875 0 1 0-1.748 0v4a1.125 1.125 0 0 1-2.25 0v-4a3.125 3.125 0 1 1 6.248 0v4a1.125 1.125 0 0 1-2.25 0M10.002 9.875l.114.006a1.126 1.126 0 0 1 0 2.239l-.114.006H9a1.125 1.125 0 0 1 0-2.25h1Zm4.999 0 .116.006a1.125 1.125 0 0 1 0 2.239l-.116.006h-1a1.126 1.126 0 0 1 0-2.25h1Zm-5-4 .115.006a1.125 1.125 0 0 1 0 2.238L10 8.125H9a1.125 1.125 0 0 1 0-2.25zm5 0a1.125 1.125 0 0 1 0 2.25h-1a1.125 1.125 0 0 1 0-2.25z"
      />
      <path
        fill={color}
        d="M17.875 6c0-1.036-.84-1.875-1.875-1.875H8c-1.035 0-1.875.84-1.875 1.875v13.875h11.75zm2.25 13.882a1.125 1.125 0 0 1-.01 2.237l-.114.006H4a1.125 1.125 0 0 1-.125-2.244V6A4.125 4.125 0 0 1 8 1.875h8A4.125 4.125 0 0 1 20.125 6z"
      />
    </svg>
  );
}
