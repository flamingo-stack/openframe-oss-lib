import type { SVGProps } from "react";
export interface Chevrons05HrIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Chevrons05HrIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Chevrons05HrIconProps) {
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
        d="M14.204 5.205a1.126 1.126 0 0 1 1.506-.078l.085.078 6 6c.44.439.44 1.151 0 1.59l-6 6a1.125 1.125 0 1 1-1.59-1.59L19.409 12l-5.204-5.205-.078-.085a1.125 1.125 0 0 1 .077-1.505m-5.999 0a1.125 1.125 0 1 1 1.59 1.59L4.591 12l5.204 5.205.078.085a1.126 1.126 0 0 1-1.584 1.583l-.084-.078-6-6a1.125 1.125 0 0 1 0-1.59z"
      />
    </svg>
  );
}
