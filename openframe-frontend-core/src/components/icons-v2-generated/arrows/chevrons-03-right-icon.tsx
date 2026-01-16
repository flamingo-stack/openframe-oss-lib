import type { SVGProps } from "react";
export interface Chevrons03RightIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Chevrons03RightIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Chevrons03RightIconProps) {
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
        d="M12.204 5.205a1.126 1.126 0 0 1 1.506-.078l.085.078 6 6a1.125 1.125 0 0 1 0 1.59l-6 6a1.125 1.125 0 1 1-1.59-1.59L17.409 12l-5.204-5.205-.078-.085a1.125 1.125 0 0 1 .077-1.505"
      />
      <path
        fill={color}
        d="M4.205 5.205a1.125 1.125 0 0 1 1.505-.078l.085.078 6 6a1.125 1.125 0 0 1 0 1.59l-6 6a1.125 1.125 0 1 1-1.59-1.59L9.409 12 4.205 6.795l-.078-.085a1.125 1.125 0 0 1 .078-1.505"
      />
    </svg>
  );
}
