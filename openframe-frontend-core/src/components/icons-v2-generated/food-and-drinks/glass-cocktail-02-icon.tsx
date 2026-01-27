import type { SVGProps } from "react";
export interface GlassCocktail02IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function GlassCocktail02Icon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: GlassCocktail02IconProps) {
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
        d="M20.874 7a3.874 3.874 0 0 0-7.671-.777l-.03.113a1.125 1.125 0 0 1-2.176-.56l.059-.26A6.125 6.125 0 0 1 23.125 7a6.125 6.125 0 0 1-10.193 4.579l-.21-.197-.08-.085a1.125 1.125 0 0 1 1.565-1.6l.086.075.274.244A3.875 3.875 0 0 0 20.875 7Z"
      />
      <path
        fill={color}
        d="M14.5 4.875c2.35 0 3.516 2.852 1.839 4.499l-6.214 6.098v5.403H12l.116.006a1.125 1.125 0 0 1 0 2.239l-.116.005H6a1.125 1.125 0 0 1 0-2.25h1.875v-5.403l-6.208-6.1c-1.676-1.647-.51-4.497 1.84-4.497zM3.508 7.125a.375.375 0 0 0-.262.643L9 13.422l5.763-5.654a.375.375 0 0 0-.262-.643H3.507Z"
      />
    </svg>
  );
}
