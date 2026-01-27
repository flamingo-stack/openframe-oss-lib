import type { SVGProps } from "react";
export interface TreeIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function TreeIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: TreeIconProps) {
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
        d="M10.875 22v-3a1.125 1.125 0 0 1 2.25 0v3a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M10.594 1.402a2.126 2.126 0 0 1 2.812 0l.166.162 3.695 4.06.141.177a1.626 1.626 0 0 1-.414 2.25l2.245 2.525c.796.896.376 2.285-.72 2.628l-.228.054-.247.041 2.635 3.399c1.083 1.396.087 3.427-1.68 3.427H5.001c-1.767 0-2.761-2.031-1.679-3.427l2.634-3.399-.248-.04c-1.26-.211-1.797-1.727-.947-2.683l2.244-2.525a1.625 1.625 0 0 1-.273-2.428l3.698-4.059zM9.098 6.365l.174.044a1.126 1.126 0 0 1 .569 1.838l-2.649 2.978.993.165a1.126 1.126 0 0 1 .704 1.8l-3.635 4.685h13.492L15.11 13.19a1.126 1.126 0 0 1 .703-1.799l.992-.165-2.647-2.978a1.126 1.126 0 0 1 .568-1.838l.173-.044L12 3.18z"
      />
    </svg>
  );
}
