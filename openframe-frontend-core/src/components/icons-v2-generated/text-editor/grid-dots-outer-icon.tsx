import type { SVGProps } from "react";
export interface GridDotsOuterIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function GridDotsOuterIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: GridDotsOuterIconProps) {
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
        d="M10.873 16.499v-.006a1.125 1.125 0 0 1 2.25 0v.006a1.125 1.125 0 0 1-2.25 0m1.125-5.63c.234 0 .452.073.632.196a1.125 1.125 0 0 1 .406 1.37 1.1 1.1 0 0 1-.193.3 1.118 1.118 0 0 1-1.778-.106 1.12 1.12 0 0 1 .137-1.43c.204-.203.485-.33.796-.33m-4.496.004.114.005a1.126 1.126 0 0 1 0 2.239l-.114.006h-.006a1.125 1.125 0 0 1 0-2.25zm8.997 0 .114.005a1.125 1.125 0 0 1 0 2.239l-.114.006h-.006a1.125 1.125 0 0 1 0-2.25zm-5.626-3.371v-.006a1.125 1.125 0 1 1 2.25 0v.006a1.126 1.126 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M19.875 6c0-1.036-.84-1.875-1.875-1.875H6c-1.036 0-1.875.84-1.875 1.875v12c0 1.035.84 1.875 1.875 1.875h12c1.035 0 1.875-.84 1.875-1.875zm2.25 12A4.125 4.125 0 0 1 18 22.125H6A4.125 4.125 0 0 1 1.875 18V6A4.125 4.125 0 0 1 6 1.875h12A4.125 4.125 0 0 1 22.125 6z"
      />
    </svg>
  );
}
