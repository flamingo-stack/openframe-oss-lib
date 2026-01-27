import type { SVGProps } from "react";
export interface ListBulletIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ListBulletIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ListBulletIconProps) {
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
        d="M21 16.875a1.125 1.125 0 0 1 0 2.25H9a1.125 1.125 0 0 1 0-2.25zm0-6a1.125 1.125 0 0 1 0 2.25H9a1.125 1.125 0 0 1 0-2.25zm0-6a1.125 1.125 0 0 1 0 2.25H9a1.125 1.125 0 0 1 0-2.25zM3 17.629a.62.62 0 0 0-.125.37l.012.127c.019.09.06.172.113.244zm1 .741a.6.6 0 0 0 .112-.245L4.125 18l-.013-.127A.6.6 0 0 0 4 17.63zm-1-6.74a.62.62 0 0 0-.125.37l.012.127c.019.09.06.172.113.244zm1 .741a.6.6 0 0 0 .112-.244L4.125 12l-.013-.126A.6.6 0 0 0 4 11.63zM3 5.63a.62.62 0 0 0-.125.37l.012.126A.6.6 0 0 0 3 6.37zm1 .741a.6.6 0 0 0 .112-.245L4.125 6l-.013-.126A.6.6 0 0 0 4 5.629v.741ZM5.125 18a1.625 1.625 0 0 1-3.242.167l-.008-.168.009-.165A1.625 1.625 0 0 1 3.5 16.375l.167.009A1.624 1.624 0 0 1 5.125 18m0-6a1.625 1.625 0 0 1-3.242.167l-.008-.168.009-.165A1.625 1.625 0 0 1 3.5 10.375l.167.009a1.623 1.623 0 0 1 1.458 1.615Zm0-6a1.625 1.625 0 0 1-3.242.167L1.876 6l.009-.166A1.625 1.625 0 0 1 3.5 4.375l.167.009A1.624 1.624 0 0 1 5.125 6"
      />
    </svg>
  );
}
