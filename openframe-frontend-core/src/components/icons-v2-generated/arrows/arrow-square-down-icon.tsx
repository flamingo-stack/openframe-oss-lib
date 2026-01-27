import type { SVGProps } from "react";
export interface ArrowSquareDownIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ArrowSquareDownIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ArrowSquareDownIconProps) {
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
        d="M19.875 6c0-1.036-.84-1.875-1.875-1.875H6c-1.036 0-1.875.84-1.875 1.875v12c0 1.035.84 1.875 1.875 1.875h12c1.035 0 1.875-.84 1.875-1.875zm2.25 12A4.125 4.125 0 0 1 18 22.125H6A4.125 4.125 0 0 1 1.875 18V6A4.125 4.125 0 0 1 6 1.875h12A4.125 4.125 0 0 1 22.125 6z"
      />
      <path
        fill={color}
        d="M10.876 8a1.125 1.125 0 0 1 2.25 0v5.284l2.078-2.079a1.125 1.125 0 1 1 1.59 1.59l-3.998 4c-.44.44-1.152.44-1.59 0l-4.001-4-.078-.085a1.125 1.125 0 0 1 1.583-1.583l.085.078 2.08 2.079z"
      />
    </svg>
  );
}
