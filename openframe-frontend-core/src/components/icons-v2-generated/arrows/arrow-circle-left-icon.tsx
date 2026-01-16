import type { SVGProps } from "react";
export interface ArrowCircleLeftIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ArrowCircleLeftIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: ArrowCircleLeftIconProps) {
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
        d="M20.875 12a8.875 8.875 0 1 0-17.75 0 8.875 8.875 0 0 0 17.75 0m2.25 0c0 6.144-4.98 11.124-11.124 11.125S.875 18.145.875 12 5.856.875 12.001.875c6.143 0 11.124 4.981 11.124 11.126Z"
      />
      <path
        fill={color}
        d="M11.205 7.205a1.125 1.125 0 0 1 1.59 1.59l-2.08 2.08H16l.116.006a1.125 1.125 0 0 1 0 2.239l-.115.006h-5.284l2.08 2.078.076.086a1.124 1.124 0 0 1-1.582 1.583l-.085-.078-4-4a1.125 1.125 0 0 1 0-1.59l4-4Z"
      />
    </svg>
  );
}
