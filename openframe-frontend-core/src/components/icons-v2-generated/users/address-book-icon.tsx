import type { SVGProps } from "react";
export interface AddressBookIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AddressBookIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: AddressBookIconProps) {
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
        d="M17.875 5c0-1.035-.84-1.875-1.875-1.875H6c-1.036 0-1.875.84-1.875 1.875v14c0 1.035.84 1.875 1.875 1.875h10c1.036 0 1.875-.84 1.875-1.875zm2.25 14A4.125 4.125 0 0 1 16 23.125H6A4.125 4.125 0 0 1 1.875 19V5A4.125 4.125 0 0 1 6 .875h10A4.125 4.125 0 0 1 20.125 5z"
      />
      <path
        fill={color}
        d="M20.875 19v-2a1.125 1.125 0 0 1 2.25 0v2a1.125 1.125 0 0 1-2.25 0m-7.75-2.5c0-.759-.615-1.375-1.374-1.375h-1.5c-.76 0-1.376.616-1.376 1.375a1.125 1.125 0 0 1-2.25 0 3.626 3.626 0 0 1 3.626-3.625h1.5a3.625 3.625 0 0 1 3.623 3.625 1.125 1.125 0 0 1-2.25 0Zm7.75-3.5v-2a1.125 1.125 0 0 1 2.25 0v2a1.125 1.125 0 0 1-2.25 0m-9.124-3.625a.75.75 0 1 0-1.501.001.75.75 0 0 0 1.5 0ZM20.875 7V5a1.125 1.125 0 0 1 2.25 0v2a1.125 1.125 0 0 1-2.25 0m-6.874 2.375a3 3 0 1 1-6.002-.001A3 3 0 0 1 14 9.375Z"
      />
    </svg>
  );
}
