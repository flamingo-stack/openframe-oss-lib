import type { SVGProps } from "react";
export interface TerraceIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function TerraceIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: TerraceIconProps) {
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
        d="M10.875 14V8.125H3.176c-1.725 0-2.261-2.333-.709-3.087l7.721-3.747.215-.098a4.13 4.13 0 0 1 3.384.095l7.742 3.749c1.553.752 1.017 3.088-.709 3.088h-7.695V14a1.125 1.125 0 0 1-2.25 0m1.932-10.686a1.88 1.88 0 0 0-1.438-.082l-.198.082-5.275 2.56h12.198z"
      />
      <path
        fill={color}
        d="M6.375 22v-2.5a.875.875 0 0 0-.875-.875H4.125V22a1.126 1.126 0 0 1-2.25 0v-4.395L.893 12.2l-.015-.115a1.126 1.126 0 0 1 2.203-.4l.026.113.832 4.576H5.5A3.125 3.125 0 0 1 8.626 19.5V22a1.126 1.126 0 0 1-2.25 0Zm4.5 0v-6.876H8a1.125 1.125 0 0 1 0-2.25h8l.115.006a1.125 1.125 0 0 1 0 2.239l-.115.005h-2.874V22a1.126 1.126 0 0 1-2.25 0Zm4.5 0v-2.5a3.124 3.124 0 0 1 3.125-3.125h1.561l.833-4.576a1.126 1.126 0 0 1 2.213.402l-.982 5.395V22a1.126 1.126 0 0 1-2.25 0v-3.375H18.5a.874.874 0 0 0-.875.875V22a1.126 1.126 0 0 1-2.25 0"
      />
    </svg>
  );
}
