import type { SVGProps } from "react";
export interface BrightnessUpIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function BrightnessUpIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: BrightnessUpIconProps) {
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
        d="M15.876 12a3.876 3.876 0 1 0-7.752.002A3.876 3.876 0 0 0 15.876 12m2.25 0a6.126 6.126 0 1 1-12.25 0 6.126 6.126 0 0 1 12.25 0m-7.25 10v-1.5a1.125 1.125 0 0 1 2.25 0V22a1.125 1.125 0 0 1-2.25 0m-5.681-4.785a1.125 1.125 0 0 1 1.59 1.591l-1.06 1.06-.086.078a1.126 1.126 0 0 1-1.506-1.668l1.062-1.06Zm12.02 0a1.124 1.124 0 0 1 1.505-.077l.086.077 1.06 1.06.078.086a1.126 1.126 0 0 1-1.583 1.583l-.085-.077-1.06-1.06-.078-.087a1.124 1.124 0 0 1 .077-1.505M3.5 10.875l.116.006a1.125 1.125 0 0 1 0 2.239l-.116.006H2a1.125 1.125 0 0 1 0-2.25h1.5Zm18.5 0a1.125 1.125 0 0 1 0 2.25h-1.5a1.126 1.126 0 0 1 0-2.25zM4.133 4.134a1.125 1.125 0 0 1 1.506-.076l.086.076 1.06 1.062.077.085A1.125 1.125 0 0 1 5.28 6.862l-.085-.076-1.062-1.06-.076-.087a1.125 1.125 0 0 1 .076-1.506Zm14.228-.076a1.125 1.125 0 0 1 1.506 1.668l-1.06 1.06a1.126 1.126 0 0 1-1.592-1.59l1.06-1.062zM10.875 3.5V2a1.125 1.125 0 0 1 2.25 0v1.5a1.125 1.125 0 0 1-2.25 0"
      />
    </svg>
  );
}
