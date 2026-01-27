import type { SVGProps } from "react";
export interface ShoesIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ShoesIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ShoesIconProps) {
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
        d="M14.049 12.908a1.125 1.125 0 0 1-2.098-.816zm-1.124-3.305a1.125 1.125 0 0 1 2.05.922l-.926 2.383L13 12.499l-1.049-.407.927-2.383zm-3.022-.956A1.125 1.125 0 1 1 12 9.46l-.95 2.447-.047.105a1.126 1.126 0 0 1-2.05-.921z"
      />
      <path
        fill={color}
        d="M.875 15V9c0-.62.504-1.124 1.125-1.124h1l.14.008c.321.04.612.218.795.491.196.292.712 1 1.565 1 .35 0 .688-.172.966-.49.297-.34.409-.711.409-.885l.009-.136a1.126 1.126 0 0 1 1.494-.923l12.054 4.304.296.12a4.057 4.057 0 0 1-1.661 7.76H5a4.125 4.125 0 0 1-4.125-4.124Zm2.25 0c0 1.036.84 1.875 1.875 1.875h14.067a1.809 1.809 0 0 0 .608-3.51L8.755 9.462a4.1 4.1 0 0 1-.595.903c-.597.681-1.511 1.26-2.66 1.26-1.024 0-1.811-.398-2.375-.84z"
      />
    </svg>
  );
}
