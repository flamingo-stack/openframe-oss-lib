import type { SVGProps } from "react";
export interface ActivitySquareIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ActivitySquareIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ActivitySquareIconProps) {
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
        d="M10.25 6.375c.464 0 .88.286 1.048.718l2.452 6.303.702-1.803.074-.155c.2-.345.569-.563.975-.563H17l.114.006a1.125 1.125 0 0 1 0 2.238l-.114.006h-.732l-1.47 3.782a1.126 1.126 0 0 1-2.098 0l-2.452-6.305-.7 1.805a1.13 1.13 0 0 1-1.049.718H7a1.125 1.125 0 0 1 0-2.25h.731l1.47-3.782.075-.155c.2-.345.569-.563.975-.563Z"
      />
    </svg>
  );
}
