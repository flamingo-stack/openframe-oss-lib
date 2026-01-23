import type { SVGProps } from "react";
export interface PrinterOffIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function PrinterOffIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: PrinterOffIconProps) {
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
        d="M20.876 15v-5c0-1.035-.84-1.874-1.875-1.874h-6.345a1.125 1.125 0 0 1 0-2.25h4.22V5A.875.875 0 0 0 16 4.125H8.656a1.125 1.125 0 0 1 0-2.25H16A3.125 3.125 0 0 1 19.125 5v.881c2.22.067 4 1.883 4 4.12v5c0 .545-.107 1.068-.301 1.547l-.048.104a1.125 1.125 0 0 1-2.037-.949l.058-.165c.05-.17.079-.35.079-.538M18 9.875l.116.005a1.126 1.126 0 0 1 0 2.239l-.116.006h-1.345a1.126 1.126 0 0 1 0-2.25zM1.205 1.205a1.125 1.125 0 0 1 1.506-.078l.085.078 20 20 .077.086a1.124 1.124 0 0 1-1.582 1.582l-.087-.078-2.408-2.408A3.12 3.12 0 0 1 16 22.125H8a3.12 3.12 0 0 1-3.118-3.007 4.12 4.12 0 0 1-4.007-4.117V10a4.12 4.12 0 0 1 3.466-4.068L1.205 2.795l-.078-.084a1.125 1.125 0 0 1 .078-1.506M7.125 19c0 .483.392.875.875.875h8a.877.877 0 0 0 .876-.875v-.534l-2.341-2.34h-7.41zm-4-4c0 .994.773 1.804 1.75 1.868v-1.867c0-.622.504-1.125 1.126-1.125h6.284L6.534 8.125H5c-1.035 0-1.875.84-1.875 1.875z"
      />
    </svg>
  );
}
