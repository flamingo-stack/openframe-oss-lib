import type { SVGProps } from "react";
export interface StarIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function StarIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: StarIconProps) {
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
        d="M9.747 2.147c1.043-1.758 3.665-1.7 4.601.176l2.026 4.055 4.498.646c2.095.3 2.967 2.81 1.587 4.344l-.139.146-3.236 3.112.768 4.418c.371 2.14-1.868 3.78-3.796 2.78L12 19.714l-4.056 2.108c-1.927 1.001-4.168-.639-3.797-2.779l.766-4.418-3.232-3.112C.107 9.998.965 7.334 3.128 7.024l4.497-.646 2.027-4.055zm2.589 1.182a.375.375 0 0 0-.671 0L9.61 7.443a2.13 2.13 0 0 1-1.6 1.153l-4.561.656a.374.374 0 0 0-.207.64l3.281 3.161.178.193c.383.474.548 1.093.442 1.701l-.778 4.483a.375.375 0 0 0 .542.396l4.113-2.137.236-.104a2.12 2.12 0 0 1 1.489 0l.234.104 4.115 2.137a.375.375 0 0 0 .542-.396l-.778-4.483a2.13 2.13 0 0 1 .62-1.894l3.28-3.161a.374.374 0 0 0-.206-.64l-4.563-.656c-.69-.1-1.287-.53-1.598-1.153z"
      />
    </svg>
  );
}
