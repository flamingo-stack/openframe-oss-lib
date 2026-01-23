import type { SVGProps } from "react";
export interface AcornIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AcornIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: AcornIconProps) {
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
        d="M5.709 4.698a1.125 1.125 0 1 1 1.49 1.686c-3.61 3.188-5.353 8.429-2.984 13.399 4.97 2.37 10.213.63 13.402-2.981l.079-.082a1.126 1.126 0 0 1 1.607 1.572l-.365.398C15.085 22.74 8.81 24.687 2.86 21.625a1.13 1.13 0 0 1-.485-.484c-3.16-6.142-.983-12.63 3.334-16.443m13.068-1.054a3.68 3.68 0 0 1 3.578-.711 1.125 1.125 0 0 1-.71 2.134 1.44 1.44 0 0 0-1.315.214l-.153.133-.882.882a1.125 1.125 0 0 1-1.59-1.591l.881-.882.19-.179Z"
      />
      <path
        fill={color}
        d="M6.025 2.55a8.28 8.28 0 0 1 10.846.75l3.83 3.83a8.277 8.277 0 0 1 .5 11.158 2.33 2.33 0 0 1-3.248.323l-.189-.168L5.558 6.235a2.33 2.33 0 0 1 .153-3.437zm9.255 2.34a6.03 6.03 0 0 0-7.899-.545l-.227.18a.08.08 0 0 0-.006.119l12.207 12.208a.08.08 0 0 0 .119-.006 6.03 6.03 0 0 0-.365-8.125z"
      />
    </svg>
  );
}
