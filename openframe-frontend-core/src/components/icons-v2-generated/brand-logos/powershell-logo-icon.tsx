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
  color = "#888888",
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
        fill="#2671BE"
        fillRule="evenodd"
        d="M10.274 19.708c-2.345 0-4.69.01-7.034-.005-1.19-.008-1.405-.287-1.138-1.442.908-3.919 1.844-7.83 2.732-11.754C5.07 5.455 5.584 4.99 6.719 5c4.69.043 9.379.014 14.068.019 1.176 0 1.374.25 1.11 1.436-.857 3.848-1.72 7.694-2.598 11.537-.328 1.438-.707 1.713-2.23 1.716-2.265.005-4.53.001-6.795 0"
        clipRule="evenodd"
      />
      <path
        fill="#FDFDFE"
        fillRule="evenodd"
        d="M12.269 12.029c-.157-.184-.33-.395-.513-.596-1.036-1.144-2.063-2.297-3.118-3.423C8.155 7.494 8 6.993 8.58 6.484c.573-.503 1.136-.458 1.661.12 1.464 1.612 2.925 3.225 4.413 4.815.556.593.426.997-.185 1.437a942 942 0 0 0-7.016 5.106c-.524.385-1.024.481-1.448-.087-.467-.627-.035-1 .45-1.35a759 759 0 0 0 5.186-3.782c.24-.177.584-.28.627-.714Z"
        clipRule="evenodd"
      />
      <path
        fill="#FCFDFD"
        fillRule="evenodd"
        d="M13.011 18.09c-.631 0-1.263.02-1.893-.008-.502-.022-.805-.301-.799-.827.006-.497.259-.871.76-.885a90 90 0 0 1 4.142-.002c.439.009.763.293.76.747-.003.52-.279.925-.84.958-.708.043-1.42.01-2.13.01z"
        clipRule="evenodd"
      />
    </svg>
  );
}
