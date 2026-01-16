import type { SVGProps } from "react";
export interface VolumeDownIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function VolumeDownIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: VolumeDownIconProps) {
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
        d="M14.124 20c0 1.932-2.368 2.862-3.682 1.446l-4.932-5.32H4A3.126 3.126 0 0 1 .875 13v-2A3.125 3.125 0 0 1 4 7.876h1.508l4.935-5.315.126-.126c1.334-1.23 3.555-.299 3.555 1.572zM3.125 13c0 .483.391.875.875.876h1.564c.517 0 1.014.188 1.399.525l.158.154 4.753 5.126V4.325l-4.753 5.12c-.402.434-.966.68-1.557.68H4a.875.875 0 0 0-.875.875zm13.75-1c0-.328-.139-.68-.458-1.007l-.15-.139-.083-.08a1.126 1.126 0 0 1 1.456-1.698l.092.07.295.275c.658.676 1.098 1.564 1.098 2.579 0 1.159-.574 2.153-1.393 2.854l-.092.07a1.124 1.124 0 0 1-1.373-1.779l.15-.138c.32-.327.458-.68.458-1.008Z"
      />
    </svg>
  );
}
