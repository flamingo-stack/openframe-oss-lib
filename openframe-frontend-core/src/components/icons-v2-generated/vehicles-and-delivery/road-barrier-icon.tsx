import type { SVGProps } from "react";
export interface RoadBarrierIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function RoadBarrierIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: RoadBarrierIconProps) {
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
        d="M4.769 4.771a1.125 1.125 0 0 1 2.203.458l-1.455 7-.03.111a1.125 1.125 0 0 1-2.173-.57zm4.571 0a1.125 1.125 0 0 1 2.204.458l-1.455 7-.03.111a1.126 1.126 0 0 1-2.173-.57L9.34 4.772Zm4.572 0a1.125 1.125 0 1 1 2.202.458l-1.455 7-.028.111a1.126 1.126 0 0 1-2.174-.57zm4.57 0a1.125 1.125 0 1 1 2.203.457l-1.454 7.001-.03.111a1.125 1.125 0 0 1-2.173-.57z"
      />
      <path
        fill={color}
        d="M20.875 20v-6.876H3.125V20a1.125 1.125 0 0 1-2.25 0V4a1.125 1.125 0 0 1 2.243-.125h17.764A1.125 1.125 0 0 1 23.124 4v16a1.125 1.125 0 0 1-2.25 0Zm-17.75-9.126h17.75V6.125H3.125z"
      />
    </svg>
  );
}
