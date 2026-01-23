import type { SVGProps } from "react";
export interface LighthouseIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function LighthouseIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: LighthouseIconProps) {
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
        d="m16 9.875.115.006a1.125 1.125 0 0 1 0 2.238l-.115.006H8a1.125 1.125 0 0 1 0-2.25zM3.497 8.993a1.125 1.125 0 0 1 1.006 2.013l-2 1a1.125 1.125 0 0 1-1.005-2.012l2-1Zm15.497.504c.26-.52.87-.751 1.403-.55l.106.046 2 1a1.125 1.125 0 0 1-1.006 2.013l-2-1-.1-.056a1.126 1.126 0 0 1-.403-1.453m-18-5c.26-.52.87-.75 1.403-.549l.106.046 2 1a1.124 1.124 0 0 1-1.006 2.013l-2-1-.1-.058a1.125 1.125 0 0 1-.403-1.451Zm20.503-.503a1.125 1.125 0 0 1 1.006 2.012l-2 1a1.125 1.125 0 0 1-1.005-2.012l2-1Z"
      />
      <path
        fill={color}
        d="M11.054 1.023a3.13 3.13 0 0 1 2.196.114l4.2 1.831.103.053a1.12 1.12 0 0 1-.428 2.092v5.736l2.615 9.592a2.124 2.124 0 0 1-2.049 2.683h-3.662l-.03.002-.029-.002h-3.94l-.03.002-.029-.002H6.31a2.124 2.124 0 0 1-2.05-2.683l2.616-9.592V5.113a1.12 1.12 0 0 1-.906-.664 1.125 1.125 0 0 1 .582-1.481l4.2-1.831zM12.874 18a.874.874 0 1 0-1.748 0v2.874h1.749V18Zm-3.768-6.852-.056.277-2.578 9.45h2.404V18a3.124 3.124 0 1 1 6.249 0v2.874h2.402l-2.577-9.45a2.1 2.1 0 0 1-.074-.557V4.3L12.35 3.2a.88.88 0 0 0-.7 0L9.125 4.3v6.567q0 .142-.02.28Z"
      />
    </svg>
  );
}
