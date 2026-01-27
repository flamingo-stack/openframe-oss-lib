import type { SVGProps } from "react";
export interface CollectionAudioIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CollectionAudioIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: CollectionAudioIconProps) {
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
        d="M.875 18V9A8.126 8.126 0 0 1 9 .875h9l.115.006a1.125 1.125 0 0 1 0 2.238L18 3.125H9A5.876 5.876 0 0 0 3.124 9v9a1.125 1.125 0 0 1-2.25 0Zm16.209-6.402a1.125 1.125 0 0 1 1.568-.264c.916.652 1.473 1.61 1.473 2.666s-.557 2.014-1.473 2.666a1.125 1.125 0 0 1-1.305-1.832c.418-.298.527-.615.527-.834s-.109-.536-.527-.834a1.125 1.125 0 0 1-.264-1.568Zm-4.048 1.21c-.21.205-.493.319-.787.319h-1.125v1.755h1.125l.219.02c.213.042.41.146.568.3l.84.818v-4.033zm3.09 4.694c0 1.436-1.729 2.17-2.76 1.165l-1.573-1.535H11a2.127 2.127 0 0 1-2.125-2.127v-2.001c0-1.173.95-2.127 2.125-2.127h.793l1.573-1.535.2-.169c1.04-.743 2.56-.013 2.56 1.333z"
      />
      <path
        fill={color}
        d="M20.875 9c0-1.035-.84-1.875-1.875-1.875H9c-1.036 0-1.875.84-1.875 1.875v10c0 1.036.84 1.875 1.875 1.875h10c1.036 0 1.875-.84 1.875-1.875zm2.25 10A4.126 4.126 0 0 1 19 23.125H9A4.125 4.125 0 0 1 4.875 19V9A4.125 4.125 0 0 1 9 4.875h10A4.125 4.125 0 0 1 23.125 9z"
      />
    </svg>
  );
}
