import type { SVGProps } from "react";
export interface HangerIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function HangerIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: HangerIconProps) {
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
        d="M10.874 9.5c0-1.398.716-2.411 1.218-3.1.275-.378.47-.633.617-.894.134-.24.17-.392.17-.506a.877.877 0 0 0-1.757 0 1.125 1.125 0 1 1-2.25 0A3.126 3.126 0 0 1 12 1.875 3.127 3.127 0 0 1 15.13 5c0 .635-.216 1.172-.458 1.604-.23.41-.535.811-.76 1.12-.5.686-.786 1.173-.787 1.776a1.125 1.125 0 0 1-2.25 0Z"
      />
      <path
        fill={color}
        d="M11.132 8.743a2.13 2.13 0 0 1 1.736 0l.268.145 8.508 5.379.24.167c2.375 1.792 1.14 5.69-1.941 5.69H4.057c-3.18 0-4.393-4.154-1.7-5.857l8.507-5.38zM3.56 16.169c-.781.495-.436 1.706.497 1.706h15.886c.933 0 1.278-1.211.498-1.706l-8.442-5.339-8.439 5.34Z"
      />
    </svg>
  );
}
