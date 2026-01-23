import type { SVGProps } from "react";
export interface WindowsLogoIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function WindowsLogoIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: WindowsLogoIconProps) {
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
        d="m2 4.832 8.173-1.11.004 7.86-8.17.046zm8.17 7.655.006 7.867-8.17-1.12v-6.8zm.99-8.91L21.997 2v9.482l-10.837.085zM22 12.56 21.997 22 11.16 20.475l-.015-7.932z"
      />
    </svg>
  );
}
