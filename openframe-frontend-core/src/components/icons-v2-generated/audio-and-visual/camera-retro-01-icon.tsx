import type { SVGProps } from "react";
export interface CameraRetro01IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CameraRetro01Icon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: CameraRetro01IconProps) {
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
        d="M20.875 8c0-1.036-.84-1.875-1.875-1.875h-2.586a2.13 2.13 0 0 1-1.503-.623l-1.377-1.377h-3.069L9.088 5.502a2.13 2.13 0 0 1-1.503.623H5c-1.035 0-1.875.84-1.875 1.875v1.875h5.41a1.125 1.125 0 0 1 0 2.25h-5.41V18c0 1.035.84 1.875 1.875 1.875h14c1.035 0 1.875-.84 1.875-1.875v-5.876h-5.41a1.125 1.125 0 0 1 0-2.25h5.41zm2.25 10A4.125 4.125 0 0 1 19 22.125H5A4.125 4.125 0 0 1 .875 18V8c0-1.5.803-2.809 2-3.53V4c0-.62.503-1.124 1.125-1.125h2c.58 0 1.056.437 1.118 1h.416l1.377-1.377.157-.141c.378-.31.853-.482 1.346-.482h3.171c.494 0 .97.172 1.348.482l.155.14 1.377 1.378H19A4.125 4.125 0 0 1 23.125 8z"
      />
      <path
        fill={color}
        d="M14.874 13a2.875 2.875 0 1 0-5.75 0 2.875 2.875 0 0 0 5.75 0m2.25 0a5.124 5.124 0 1 1-10.248 0 5.124 5.124 0 0 1 10.248 0"
      />
    </svg>
  );
}
