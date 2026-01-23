import type { SVGProps } from "react";
export interface Loading03IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Loading03Icon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: Loading03IconProps) {
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
        d="M10.876 22v-3a1.125 1.125 0 0 1 2.25 0v3a1.125 1.125 0 0 1-2.25 0m-4.62-5.845a1.125 1.125 0 1 1 1.59 1.59l-2.12 2.122-.087.077a1.126 1.126 0 0 1-1.506-1.668l2.122-2.121Zm9.899 0a1.124 1.124 0 0 1 1.504-.078l.087.078 2.12 2.12.078.086a1.126 1.126 0 0 1-1.583 1.583l-.085-.077-2.121-2.121-.078-.087a1.124 1.124 0 0 1 .078-1.504M5 10.875a1.125 1.125 0 0 1 0 2.25H2a1.125 1.125 0 0 1 0-2.25zm17 0 .115.006a1.125 1.125 0 0 1 0 2.239l-.115.006h-3a1.126 1.126 0 0 1 0-2.25h3ZM4.133 4.134a1.125 1.125 0 0 1 1.506-.076l.086.076 2.121 2.122.076.085A1.125 1.125 0 0 1 6.34 7.922l-.085-.076-2.122-2.12-.076-.087a1.125 1.125 0 0 1 .076-1.506Zm14.228-.076a1.125 1.125 0 0 1 1.506 1.668l-2.121 2.121a1.125 1.125 0 0 1-1.591-1.59l2.12-2.123zM10.875 5V2a1.125 1.125 0 0 1 2.25 0v3a1.125 1.125 0 0 1-2.25 0"
      />
    </svg>
  );
}
