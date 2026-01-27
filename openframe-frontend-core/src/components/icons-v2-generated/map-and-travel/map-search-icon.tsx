import type { SVGProps } from "react";
export interface MapSearchIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function MapSearchIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: MapSearchIconProps) {
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
        d="M19.875 18a1.875 1.875 0 1 0-3.75 0 1.875 1.875 0 0 0 3.75 0m2.25 0c0 .73-.192 1.415-.524 2.01l1.195 1.195.076.085a1.125 1.125 0 0 1-1.582 1.582l-.085-.076L20.01 21.6a4.125 4.125 0 1 1 2.115-3.6"
      />
      <path
        fill={color}
        d="M14.375 11.466V5.708l-4.75-2.272V18.29l2.288 1.095.1.056a1.126 1.126 0 0 1-.966 2.018l-.107-.043-2.421-1.16-4.546 2.343C2.56 23.328.875 22.3.875 20.71V6.22c0-1.17.654-2.241 1.693-2.777L6.66 1.334l.218-.104A4.1 4.1 0 0 1 8.497.877L8.5.875l.005.002a4.1 4.1 0 0 1 1.824.403l5.15 2.464 4.547-2.341.268-.117c1.35-.482 2.83.514 2.83 2.005v8.95a1.125 1.125 0 0 1-2.25 0V3.496l-4.249 2.189v5.781a1.125 1.125 0 0 1-2.25 0m-11.25 9.038 4.25-2.191V3.496L3.6 5.441a.88.88 0 0 0-.475.778z"
      />
    </svg>
  );
}
