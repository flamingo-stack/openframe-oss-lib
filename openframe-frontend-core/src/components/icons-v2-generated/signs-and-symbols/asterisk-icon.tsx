import type { SVGProps } from "react";
export interface AsteriskIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AsteriskIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: AsteriskIconProps) {
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
        d="M10.875 21v-7.077L4.553 17.48a1.126 1.126 0 0 1-1.105-1.96L9.706 12 3.448 8.48l-.097-.062a1.125 1.125 0 0 1 1.098-1.95l.104.052 6.322 3.555V3a1.125 1.125 0 0 1 2.25 0v7.077l6.323-3.557.104-.051a1.125 1.125 0 0 1 1 2.011L14.294 12l6.258 3.52.098.062a1.126 1.126 0 0 1-1.098 1.95l-.104-.052-6.323-3.558V21a1.125 1.125 0 0 1-2.25 0"
      />
    </svg>
  );
}
