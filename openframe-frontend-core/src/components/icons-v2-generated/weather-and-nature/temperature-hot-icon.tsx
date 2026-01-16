import type { SVGProps } from "react";
export interface TemperatureHotIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function TemperatureHotIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: TemperatureHotIconProps) {
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
        d="M8.375 4.5a1.375 1.375 0 1 0-2.75 0v9.897c0 .582-.238 1.076-.543 1.441l-.135.148a2.875 2.875 0 1 0 4.288.204l-.182-.204c-.367-.373-.678-.924-.678-1.589zm2.25 9.868.005.01.028.034.167.177a5.124 5.124 0 1 1-7.484-.177l.028-.034.006-.01V4.5a3.626 3.626 0 0 1 7.25 0zm6.675 1.933a1.124 1.124 0 0 1 1.505-.077l.087.077.707.706a1.125 1.125 0 0 1-1.59 1.593l-.708-.708-.078-.085a1.126 1.126 0 0 1 .078-1.506ZM15.626 12.5c0-1.1-.837-2.005-1.909-2.114l-.217-.011-.115-.006a1.125 1.125 0 0 1 .115-2.244l.226.005a4.376 4.376 0 0 1 1.277 8.479 1.125 1.125 0 0 1-.773-2.112 2.13 2.13 0 0 0 1.396-1.997M21 11.375a1.125 1.125 0 0 1-.002 2.25H20a1.125 1.125 0 0 1 0-2.25zM18.008 6.4A1.125 1.125 0 0 1 19.6 7.993l-.707.706A1.125 1.125 0 1 1 17.3 7.108zM12.374 6V5a1.126 1.126 0 0 1 2.25 0v1a1.125 1.125 0 0 1-2.25 0"
      />
    </svg>
  );
}
