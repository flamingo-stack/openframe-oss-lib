import type { SVGProps } from "react";
export interface DeviceOnlineIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
  secondaryColor?: string;
}
export function DeviceOnlineIcon({
  className = "",
  size = 24,
  color = "currentColor",
  secondaryColor = "var(--color-success)",
  ...props
}: DeviceOnlineIconProps) {
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
      <path fill={secondaryColor} d="M23 5A4 4 0 1 1 15 5 4 4 0 0 1 23 5" />
      <path
        fill={color}
        d="M10.876 17a1.125 1.125 0 0 1 2.25 0v2.875H16l.115.006a1.125 1.125 0 0 1 0 2.239l-.115.005H8a1.125 1.125 0 0 1 0-2.25h2.876z"
      />
      <path
        fill={color}
        d="M.853 14V6a4.15 4.15 0 0 1 4.15-4.15h5.959a1.15 1.15 0 0 1 0 2.3h-5.96A1.85 1.85 0 0 0 3.154 6v8a1.85 1.85 0 0 0 1.85 1.85H19A1.85 1.85 0 0 0 20.85 14v-.998a1.15 1.15 0 0 1 2.3 0V14A4.15 4.15 0 0 1 19 18.15H5.003A4.15 4.15 0 0 1 .853 14"
      />
    </svg>
  );
}
