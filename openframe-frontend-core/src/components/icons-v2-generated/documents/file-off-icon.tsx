import type { SVGProps } from "react";
export interface FileOffIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function FileOffIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: FileOffIconProps) {
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
        d="M18.875 14.34V9.125H16A3.125 3.125 0 0 1 12.875 6V3.125H7.66a1.125 1.125 0 0 1 0-2.25h5.926q.347 0 .67.108l.21.082.168.087q.165.094.313.217l.142.129 5.414 5.414.129.142q.122.147.216.312l.087.168.082.21q.107.323.108.67v5.926a1.125 1.125 0 0 1-2.25 0M15.125 6c0 .483.392.875.875.875h1.284l-2.159-2.16zM1.205 1.205a1.125 1.125 0 0 1 1.506-.078l.084.078 20 19.999.078.087a1.124 1.124 0 0 1-1.582 1.581l-.087-.077-1.093-1.093a4.1 4.1 0 0 1-3.11 1.422H7A4.125 4.125 0 0 1 2.875 19V5q.001-.253.032-.502L1.205 2.795l-.078-.085a1.125 1.125 0 0 1 .078-1.505m3.92 17.794c0 1.036.84 1.875 1.875 1.875h10a1.87 1.87 0 0 0 1.513-.77L5.125 6.715V19Z"
      />
    </svg>
  );
}
