import type { SVGProps } from "react";
export interface MapIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function MapIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: MapIconProps) {
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
        d="M14.376 22V5a1.126 1.126 0 0 1 2.25 0v17a1.126 1.126 0 0 1-2.25 0m-7.001-3V2.002a1.125 1.125 0 0 1 2.25 0v17a1.126 1.126 0 0 1-2.25 0Z"
      />
      <path
        fill={color}
        d="M.875 6.22c0-1.17.654-2.242 1.693-2.778L6.66 1.334l.218-.104a4.12 4.12 0 0 1 3.451.05l5.15 2.464 4.547-2.341.268-.117c1.35-.482 2.83.514 2.83 2.005v14.49a3.12 3.12 0 0 1-1.502 2.67l-.19.108-4.092 2.107a4.12 4.12 0 0 1-3.45.153l-.22-.098-5.151-2.466L3.973 22.6c-1.413.728-3.098-.3-3.098-1.89zm2.25 14.284L7.984 18l.12-.052c.285-.107.604-.095.882.038l5.656 2.707.202.082c.48.164 1.01.128 1.466-.107l4.091-2.108a.88.88 0 0 0 .474-.778V3.496L16.015 6a1.13 1.13 0 0 1-1 .015L9.358 3.31a1.88 1.88 0 0 0-1.667.024L3.6 5.441a.88.88 0 0 0-.475.778z"
      />
    </svg>
  );
}
