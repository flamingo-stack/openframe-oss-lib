import type { SVGProps } from "react";
export interface SortZaDownIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function SortZaDownIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: SortZaDownIconProps) {
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
        d="M18 12.375c.46 0 .874.28 1.044.707l3 7.5.038.109a1.126 1.126 0 0 1-2.078.832l-.049-.105-.317-.793h-3.276l-.318.793a1.125 1.125 0 0 1-2.088-.835l3-7.5.074-.154c.2-.34.568-.554.97-.554m-.738 6h1.476L18 16.528zm3.238-16.5a1.126 1.126 0 0 1 .891 1.81l-3.606 4.69H20.5l.115.005a1.126 1.126 0 0 1 0 2.239l-.114.005h-5.002a1.125 1.125 0 0 1-.89-1.81l3.606-4.689H15.5a1.125 1.125 0 0 1 0-2.25zM5.875 3v15.284l-2.08-2.08a1.125 1.125 0 0 0-1.59 1.59l4 4.001.085.078c.442.36 1.094.334 1.506-.078l3.999-4 .078-.085a1.125 1.125 0 0 0-1.582-1.582l-.087.076-2.079 2.08V3a1.125 1.125 0 0 0-2.25 0"
      />
    </svg>
  );
}
