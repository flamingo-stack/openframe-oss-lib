import type { SVGProps } from "react";
export interface ActivityCircleIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ActivityCircleIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: ActivityCircleIconProps) {
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
        d="M10.25 6.375c.464 0 .88.286 1.048.718l2.452 6.303.702-1.803.074-.155c.2-.345.569-.563.975-.563H17l.114.006a1.125 1.125 0 0 1 0 2.238l-.114.006h-.732l-1.47 3.782a1.126 1.126 0 0 1-2.098 0l-2.452-6.305-.7 1.805a1.13 1.13 0 0 1-1.049.718H7a1.125 1.125 0 0 1 0-2.25h.731l1.47-3.782.075-.155c.2-.345.569-.563.975-.563Z"
      />
    </svg>
  );
}
