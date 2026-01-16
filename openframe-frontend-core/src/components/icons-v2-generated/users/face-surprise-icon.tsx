import type { SVGProps } from "react";
export interface FaceSurpriseIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function FaceSurpriseIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: FaceSurpriseIconProps) {
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
        d="M12 15.874a.127.127 0 0 0-.126.126l.01.049a.125.125 0 0 0 .23 0l.011-.049-.01-.05a.13.13 0 0 0-.066-.065zm3-6.747a.62.62 0 0 0-.126.373l.014.125a.6.6 0 0 0 .113.247zm1 .745a.6.6 0 0 0 .112-.247l.014-.125-.014-.126A.6.6 0 0 0 16 9.127zm-6.888-.498A.6.6 0 0 0 9 9.129v.741a.6.6 0 0 0 .112-.245l.013-.125zM8 9.129a.62.62 0 0 0-.125.37l.012.126A.6.6 0 0 0 8 9.87zM14.124 16a2.124 2.124 0 0 1-4.239.217l-.01-.216.01-.219a2.126 2.126 0 0 1 2.116-1.907l.216.01A2.126 2.126 0 0 1 14.124 16m-3.998-6.5a1.625 1.625 0 0 1-3.242.167L6.875 9.5l.009-.166A1.625 1.625 0 0 1 8.5 7.875l.166.009c.82.083 1.46.774 1.46 1.616m6.999 0a1.625 1.625 0 0 1-3.242.166l-.007-.166.007-.166a1.626 1.626 0 0 1 3.242.166"
      />
    </svg>
  );
}
