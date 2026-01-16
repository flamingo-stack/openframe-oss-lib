import type { SVGProps } from "react";
export interface TruckMedicalIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function TruckMedicalIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: TruckMedicalIconProps) {
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
        d="m15.05 16.875.116.006a1.125 1.125 0 0 1 0 2.238l-.116.006H10a1.125 1.125 0 0 1 0-2.25zM.875 15V6A4.125 4.125 0 0 1 5 1.875h8.5a3.12 3.12 0 0 1 3.12 3h.838c1.02 0 1.976.498 2.561 1.333l2.36 3.372c.211.302.376.63.5.973l.014.038c.15.433.232.89.232 1.355V15a4.13 4.13 0 0 1-2.86 3.927l-.111.03a1.125 1.125 0 0 1-.579-2.171l.14-.052A1.88 1.88 0 0 0 20.874 15v-2.876H16.5a2.125 2.125 0 0 1-2.125-2.123V5a.875.875 0 0 0-.874-.875H5c-1.036 0-1.875.84-1.875 1.875v9c0 .814.52 1.51 1.25 1.768a1.125 1.125 0 0 1-.75 2.123A4.13 4.13 0 0 1 .875 15m15.75-5.125h3.214l-1.664-2.376a.88.88 0 0 0-.716-.374h-.834z"
      />
      <path
        fill={color}
        d="M8.875 18a1.874 1.874 0 1 0-3.749 0 1.874 1.874 0 0 0 3.749 0m10 .5a1.376 1.376 0 1 0-2.751 0 1.376 1.376 0 0 0 2.752 0Zm-11.25-7v-1.374H6.25a1.125 1.125 0 0 1 0-2.25h1.375V6.5a1.125 1.125 0 0 1 2.25 0v1.375h1.374l.116.006a1.125 1.125 0 0 1 0 2.239l-.116.006H9.875v1.373a1.125 1.125 0 0 1-2.25 0Zm13.5 7a3.626 3.626 0 1 1-7.251 0 3.626 3.626 0 0 1 7.251 0m-10-.5a4.125 4.125 0 1 1-8.25 0 4.125 4.125 0 0 1 8.25 0"
      />
    </svg>
  );
}
