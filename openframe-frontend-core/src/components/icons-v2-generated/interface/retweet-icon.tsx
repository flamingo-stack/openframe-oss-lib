import type { SVGProps } from "react";
export interface RetweetIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function RetweetIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: RetweetIconProps) {
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
        d="M17.875 8c0-1.035-.84-1.875-1.875-1.875h-4a1.125 1.125 0 0 1 0-2.25h4A4.125 4.125 0 0 1 20.125 8v8.284l1.08-1.08a1.125 1.125 0 0 1 1.59 1.59l-3 3a1.126 1.126 0 0 1-1.59 0l-3-3-.078-.084a1.126 1.126 0 0 1 1.582-1.582l.087.076 1.08 1.08zm-14 8V7.715l-1.08 1.08a1.125 1.125 0 1 1-1.59-1.591l3-3 .085-.078a1.125 1.125 0 0 1 1.505.078l3 3 .078.085A1.125 1.125 0 0 1 7.29 8.873l-.085-.078-1.08-1.08V16c0 1.035.84 1.875 1.875 1.875h4l.115.005a1.126 1.126 0 0 1 0 2.239l-.114.006H8a4.125 4.125 0 0 1-4.125-4.126Z"
      />
    </svg>
  );
}
