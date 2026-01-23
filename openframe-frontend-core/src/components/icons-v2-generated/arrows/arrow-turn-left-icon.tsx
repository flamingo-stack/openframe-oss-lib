import type { SVGProps } from "react";
export interface ArrowTurnLeftIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ArrowTurnLeftIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ArrowTurnLeftIconProps) {
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
        d="M18.875 8V4a1.125 1.125 0 0 1 2.25 0v4l-.01.367A7.126 7.126 0 0 1 14 15.125H3a1.125 1.125 0 0 1 0-2.25h11a4.876 4.876 0 0 0 4.869-4.624l.006-.25Z"
      />
      <path
        fill={color}
        d="M8.205 7.205a1.125 1.125 0 1 1 1.59 1.59L4.591 14l5.204 5.205.078.085a1.125 1.125 0 0 1-1.583 1.583l-.085-.078-6-6a1.125 1.125 0 0 1 0-1.59z"
      />
    </svg>
  );
}
