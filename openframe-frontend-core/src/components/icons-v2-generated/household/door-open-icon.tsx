import type { SVGProps } from "react";
export interface DoorOpenIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function DoorOpenIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: DoorOpenIconProps) {
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
        d="M2.875 7c0-1.726 1.4-3.125 3.125-3.125h3.5a1.125 1.125 0 0 1 0 2.25H6A.876.876 0 0 0 5.125 7v15c0 .62-.504 1.125-1.125 1.125H2a1.125 1.125 0 1 1 0-2.25h.875zM13 11.629a.62.62 0 0 0-.125.372l.013.126a.6.6 0 0 0 .111.243zm1 .74a.6.6 0 0 0 .113-.242l.011-.127-.011-.126A.6.6 0 0 0 14 11.63v.74Zm1.125-.368a1.625 1.625 0 0 1-3.242.165l-.008-.165.008-.167a1.626 1.626 0 0 1 1.618-1.46l.165.01c.82.082 1.459.775 1.459 1.617"
      />
      <path
        fill={color}
        d="M18.875 7.195c0-.817-.528-1.54-1.306-1.787l-6.444-2.051v17.518h7.75zm2.25 13.68H22l.116.006a1.125 1.125 0 0 1 0 2.238l-.116.006H10A1.125 1.125 0 0 1 8.875 22V2.504c0-1.03.94-1.782 1.92-1.598l.198.049 7.257 2.308a4.13 4.13 0 0 1 2.875 3.932z"
      />
    </svg>
  );
}
