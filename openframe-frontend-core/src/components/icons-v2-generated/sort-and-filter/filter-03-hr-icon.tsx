import type { SVGProps } from "react";
export interface Filter03HrIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Filter03HrIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Filter03HrIconProps) {
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
        d="M10.874 21v-4a1.126 1.126 0 0 1 2.25 0v4a1.125 1.125 0 0 1-2.25 0m-1.999-7v-4a1.125 1.125 0 1 1 2.25 0v4a1.125 1.125 0 0 1-2.25 0m4-7V3a1.125 1.125 0 0 1 2.25 0v4a1.126 1.126 0 0 1-2.25 0"
      />
    </svg>
  );
}
