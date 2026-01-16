import type { SVGProps } from "react";
export interface VennDiagramIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function VennDiagramIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: VennDiagramIconProps) {
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
        d="M20.875 12a5.875 5.875 0 0 0-10.85-3.125h5.684l.116.005a1.125 1.125 0 0 1 0 2.239l-.115.005H9.19a6 6 0 0 0 0 1.751h6.52l.115.006a1.124 1.124 0 0 1 0 2.238l-.115.006h-5.684a5.874 5.874 0 0 0 10.849-3.124Zm2.25 0a8.125 8.125 0 1 1-16.25-.002 8.125 8.125 0 0 1 16.25.003Z"
      />
      <path
        fill={color}
        d="M14.874 12a5.875 5.875 0 1 0-11.75 0 5.875 5.875 0 0 0 11.75 0m2.25 0a8.125 8.125 0 1 1-16.249-.002 8.125 8.125 0 0 1 16.25.003Z"
      />
    </svg>
  );
}
