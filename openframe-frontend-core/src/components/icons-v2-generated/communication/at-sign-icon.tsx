import type { SVGProps } from "react";
export interface AtSignIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AtSignIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: AtSignIconProps) {
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
        d="M12 6.875c1.146 0 2.204.376 3.058 1.01a1.124 1.124 0 0 1 2.067.615V13c0 1.054.872 1.874 1.875 1.874s1.875-.82 1.875-1.875v-.998A8.875 8.875 0 1 0 12 20.875c1.39 0 2.702-.32 3.871-.887a1.126 1.126 0 0 1 .984 2.023A11.1 11.1 0 0 1 12 23.125C5.857 23.125.876 18.145.876 12 .875 5.856 5.856.875 12.001.875c6.143 0 11.124 4.981 11.124 11.126v.998c0 2.346-1.929 4.126-4.125 4.126a4.15 4.15 0 0 1-3.267-1.616A5.125 5.125 0 1 1 12 6.875m-2.875 5.126a2.875 2.875 0 0 0 5.735.293l.014-.293-.014-.295a2.875 2.875 0 0 0-5.735.295"
      />
    </svg>
  );
}
