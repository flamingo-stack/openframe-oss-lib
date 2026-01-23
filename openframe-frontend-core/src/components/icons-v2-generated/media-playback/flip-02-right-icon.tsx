import type { SVGProps } from "react";
export interface Flip02RightIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Flip02RightIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: Flip02RightIconProps) {
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
        d="M1.875 14a8.126 8.126 0 0 1 8.126-8.125H21l.116.006a1.125 1.125 0 0 1 0 2.238L21 8.125H10a5.876 5.876 0 0 0 0 11.75h5l.116.005a1.126 1.126 0 0 1 0 2.239l-.116.005h-5A8.125 8.125 0 0 1 1.876 14Z"
      />
      <path
        fill={color}
        d="M16.205 11.795a1.125 1.125 0 0 0 1.505.078l.085-.078 4-4a1.125 1.125 0 0 0 0-1.591l-4-3.999a1.125 1.125 0 1 0-1.59 1.59l3.203 3.206-3.203 3.203-.078.085a1.125 1.125 0 0 0 .078 1.506"
      />
    </svg>
  );
}
