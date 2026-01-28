import type { SVGProps } from "react";
export interface PowershellLogoIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function PowershellLogoIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: PowershellLogoIconProps) {
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
        fillRule="evenodd"
        d="M10.274 19.708c-2.345 0-4.69.01-7.034-.005-1.19-.008-1.405-.286-1.138-1.442.908-3.919 1.844-7.83 2.732-11.754C5.07 5.455 5.584 4.99 6.719 5c4.69.043 9.379.014 14.068.019 1.176 0 1.374.25 1.11 1.436-.858 3.848-1.72 7.694-2.598 11.537-.328 1.438-.706 1.713-2.23 1.716-2.265.005-4.53.001-6.795 0"
        clipRule="evenodd"
      />
      <path
        fill="#212121"
        fillRule="evenodd"
        d="M12.269 12.029c-.157-.184-.33-.395-.513-.596-1.036-1.144-2.063-2.297-3.118-3.423C8.155 7.494 8 6.993 8.58 6.484c.573-.503 1.136-.458 1.661.12 1.464 1.612 2.925 3.225 4.413 4.815.556.593.426.997-.185 1.437a937 937 0 0 0-7.016 5.106c-.525.385-1.024.481-1.448-.087-.467-.626-.035-1 .45-1.35a764 764 0 0 0 5.186-3.782c.24-.177.584-.28.627-.714M13.012 18.09c-.632 0-1.264.02-1.894-.008-.502-.022-.805-.301-.798-.827.006-.497.258-.871.76-.885a90 90 0 0 1 4.142-.002c.438.009.762.293.76.747-.004.52-.28.925-.841.958-.708.043-1.42.01-2.13.01z"
        clipRule="evenodd"
      />
    </svg>
  );
}
