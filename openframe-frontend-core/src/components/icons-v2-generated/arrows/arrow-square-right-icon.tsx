import type { SVGProps } from "react";
export interface ArrowSquareRightIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ArrowSquareRightIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: ArrowSquareRightIconProps) {
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
        d="M11.205 7.205a1.125 1.125 0 0 1 1.505-.078l.086.078 3.999 4a1.125 1.125 0 0 1 0 1.59l-4 4a1.125 1.125 0 1 1-1.59-1.59l2.079-2.08H8a1.125 1.125 0 0 1 0-2.25h5.284l-2.079-2.08-.078-.085a1.125 1.125 0 0 1 .078-1.505"
      />
    </svg>
  );
}
