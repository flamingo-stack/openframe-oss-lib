import type { SVGProps } from "react";
export interface FaceWinkIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function FaceWinkIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: FaceWinkIconProps) {
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
        d="M15.1 14.324a1.125 1.125 0 0 1 1.8 1.352 6.12 6.12 0 0 1-4.9 2.45 6.12 6.12 0 0 1-4.899-2.45l.9-.675.899-.677a3.87 3.87 0 0 0 3.1 1.551 3.87 3.87 0 0 0 3.1-1.55Zm-7.776-.223a1.126 1.126 0 0 1 1.576.223l-1.8 1.352a1.125 1.125 0 0 1 .223-1.575Zm.493-3.578a1.126 1.126 0 0 1-1.634-1.546zM6.183 8.977a3.534 3.534 0 0 1 5.134 0 1.124 1.124 0 1 1-1.635 1.546 1.284 1.284 0 0 0-1.865 0zm8.816.151a.62.62 0 0 0-.124.372l.013.126c.019.09.059.172.111.244zM16 9.87a.6.6 0 0 0 .113-.244l.012-.126-.012-.126A.6.6 0 0 0 16 9.128zm1.125-.37a1.625 1.625 0 0 1-3.242.166l-.008-.166.008-.167a1.626 1.626 0 0 1 1.618-1.459l.165.01c.82.082 1.459.775 1.459 1.616"
      />
    </svg>
  );
}
