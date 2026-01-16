import type { SVGProps } from "react";
export interface Arrow02LeftIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Arrow02LeftIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Arrow02LeftIconProps) {
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
        d="M1.875 17V7a1.125 1.125 0 0 1 2.25 0v10a1.125 1.125 0 0 1-2.25 0M12.204 6.205a1.125 1.125 0 0 1 1.59 1.59l-3.078 3.08H21l.115.005a1.126 1.126 0 0 1 0 2.239l-.114.005H10.715l3.079 3.081.078.085a1.126 1.126 0 0 1-1.582 1.582l-.087-.076-5-5.001a1.125 1.125 0 0 1 0-1.59l5-5Z"
      />
    </svg>
  );
}
