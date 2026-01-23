import type { SVGProps } from "react";
export interface Filter04HrIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Filter04HrIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: Filter04HrIconProps) {
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
        d="m12 17.875.115.005a1.125 1.125 0 0 1 0 2.239l-.116.006H4a1.125 1.125 0 0 1 0-2.25zm8 0 .115.005a1.126 1.126 0 0 1 0 2.239l-.114.006H16a1.125 1.125 0 0 1 0-2.25zm-14-7 .115.006a1.125 1.125 0 0 1 0 2.239L6 13.126H4a1.125 1.125 0 0 1 0-2.25zm14 0 .115.006a1.126 1.126 0 0 1 0 2.239l-.114.006H10a1.125 1.125 0 0 1 0-2.25h10Zm-6-7 .115.006a1.125 1.125 0 0 1 0 2.238L14 6.125H4a1.125 1.125 0 0 1 0-2.25zm6 0 .115.006a1.125 1.125 0 0 1 0 2.238L20 6.125h-2.002a1.125 1.125 0 0 1 0-2.25z"
      />
      <path
        fill={color}
        d="M14.876 19a.876.876 0 1 0-1.75 0 .876.876 0 0 0 1.75 0m-6.001-7a.875.875 0 1 0-1.75.001.875.875 0 0 0 1.75 0Zm8-7a.875.875 0 1 0-1.75 0 .875.875 0 0 0 1.75 0m.25 14a3.126 3.126 0 1 1-6.251-.002 3.126 3.126 0 0 1 6.251.002m-6-7a3.125 3.125 0 1 1-6.25-.002 3.125 3.125 0 0 1 6.25.002m8-7a3.126 3.126 0 1 1-6.252 0 3.126 3.126 0 0 1 6.252 0"
      />
    </svg>
  );
}
