import type { SVGProps } from "react";
export interface WaterDropletIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function WaterDropletIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: WaterDropletIconProps) {
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
        d="M18.875 13.453c0-2.186-1.033-4.293-2.424-6.122-1.21-1.59-2.626-2.886-3.663-3.735l-.42-.335a.58.58 0 0 0-.736 0c-1.048.82-2.702 2.254-4.084 4.07-1.39 1.829-2.423 3.936-2.423 6.122v.546c0 3.63 3.094 6.876 6.874 6.876S18.875 17.63 18.875 14v-.546Zm2.25.546c0 4.84-4.07 9.126-9.126 9.126s-9.124-4.287-9.124-9.126v-.546c0-2.884 1.349-5.467 2.883-7.484C7.3 3.94 9.117 2.371 10.245 1.49a2.83 2.83 0 0 1 3.51 0c1.129.882 2.945 2.451 4.488 4.48 1.534 2.017 2.883 4.6 2.883 7.484z"
      />
      <path
        fill={color}
        d="M6.875 14a1.125 1.125 0 0 1 2.25 0 2.876 2.876 0 0 0 2.581 2.86l.295.015.114.006a1.126 1.126 0 0 1 0 2.239l-.114.005-.264-.007A5.125 5.125 0 0 1 6.875 14"
      />
    </svg>
  );
}
