import type { SVGProps } from "react";
export interface TicketIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function TicketIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: TicketIconProps) {
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
        d="M20.875 7.5c0-1.036-.84-1.875-1.875-1.875H5c-1.036 0-1.875.84-1.875 1.875v.932a3.622 3.622 0 0 1 0 7.135v.933c0 1.035.84 1.875 1.875 1.875h14c1.035 0 1.875-.84 1.875-1.875v-.933a3.623 3.623 0 0 1 0-7.135zm2.25 2c0 .62-.504 1.124-1.125 1.124h-.5a1.376 1.376 0 0 0 0 2.752h.5c.62 0 1.125.503 1.125 1.125V16.5A4.125 4.125 0 0 1 19 20.625H5A4.125 4.125 0 0 1 .875 16.5v-2c0-.62.504-1.124 1.125-1.124h.5a1.376 1.376 0 0 0 0-2.752H2A1.125 1.125 0 0 1 .875 9.5v-2A4.125 4.125 0 0 1 5 3.375h14A4.125 4.125 0 0 1 23.125 7.5z"
      />
      <path
        fill={color}
        d="M7.875 16.5v-1a1.125 1.125 0 0 1 2.25 0v1a1.125 1.125 0 0 1-2.25 0m0-4v-1a1.125 1.125 0 0 1 2.25 0v1a1.125 1.125 0 0 1-2.25 0m0-4v-1a1.125 1.125 0 0 1 2.25 0v1a1.125 1.125 0 0 1-2.25 0"
      />
    </svg>
  );
}
