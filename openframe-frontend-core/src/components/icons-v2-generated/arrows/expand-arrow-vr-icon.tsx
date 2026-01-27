import type { SVGProps } from "react";
export interface ExpandArrowVrIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ExpandArrowVrIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ExpandArrowVrIconProps) {
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
        d="M10.875 22V2a1.125 1.125 0 0 1 2.25 0v20a1.125 1.125 0 1 1-2.25 0"
      />
      <path
        fill={color}
        d="M15.204 17.205a1.125 1.125 0 1 1 1.591 1.59l-4 4c-.438.44-1.15.44-1.59 0l-4-4-.078-.086a1.125 1.125 0 0 1 1.583-1.582l.085.078L12 20.41l3.205-3.204ZM11.29 1.127a1.126 1.126 0 0 1 1.506.078l3.999 4 .078.085a1.126 1.126 0 0 1-1.582 1.582l-.087-.076L12 3.59 8.795 6.796a1.125 1.125 0 0 1-1.59-1.59l4-4.001z"
      />
    </svg>
  );
}
