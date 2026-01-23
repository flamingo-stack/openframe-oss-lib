import type { SVGProps } from "react";
export interface Flag02IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Flag02Icon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: Flag02IconProps) {
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
        d="M17.685 1.875c.533 0 1.01-.002 1.385.032.306.028.731.089 1.11.331l.16.116.18.166c.397.408.615.962.6 1.538-.015.536-.287.967-.491 1.252q-.166.23-.393.5l-.489.57-1.992 2.31c-.126.145-.205.24-.26.31.055.07.134.165.26.31l1.992 2.31c.349.403.662.764.882 1.07.179.25.41.61.474 1.056l.017.196-.008.245a2.13 2.13 0 0 1-.772 1.459c-.415.34-.92.415-1.27.447-.375.034-.852.032-1.385.032H4a1.125 1.125 0 0 1 0-2.25h13.685c.451 0 .767-.005 1.003-.016a23 23 0 0 0-.643-.77l-1.994-2.308a10 10 0 0 1-.422-.511 2.3 2.3 0 0 1-.277-.473l-.07-.2a2.13 2.13 0 0 1 0-1.195l.07-.199c.08-.188.182-.344.277-.473.12-.161.273-.339.422-.511l1.994-2.309.464-.543c.07-.084.127-.16.179-.227a23 23 0 0 0-1.003-.015H4a1.125 1.125 0 0 1 0-2.25z"
      />
      <path
        fill={color}
        d="M2.875 22V2a1.125 1.125 0 0 1 2.25 0v20a1.125 1.125 0 0 1-2.25 0"
      />
    </svg>
  );
}
