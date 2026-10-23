import type { SVGProps } from "react";
export interface JumpInIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function JumpInIcon({
  className = "",
  size = 24,
  color = "var(--color-text-primary)",
  ...props
}: JumpInIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 80 80"
      width={size}
      height={size}
      className={className}
      {...props}
    >
      <path
        stroke={color}
        d="M40.093 52.722v6.806m0-6.806-8.75 5.833m8.75-5.833 8.75 5.833m-8.75-5.833v-4.861m16.528-27.222v21.389a5.833 5.833 0 0 1-5.833 5.833h-21.39a5.833 5.833 0 0 1-5.832-5.833v-21.39m33.055 0h2.917m-2.917 0H23.566m0 0h-2.917m10.694 18.473 5.247-5.245c.63-.631 1.61-.752 2.374-.293l2.258 1.354a1.944 1.944 0 0 0 2.375-.292l5.246-5.246"
      />
      <path
        stroke={color}
        d="m16.667 16.666 46.666 46.667m10-23.334c0 18.41-14.924 33.334-33.333 33.334-18.41 0-33.333-14.924-33.333-33.334S21.59 6.666 40 6.666 73.333 21.59 73.333 39.999Z"
      />
    </svg>
  );
}
