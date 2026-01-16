import type { SVGProps } from "react";
export interface ShapesIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ShapesIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: ShapesIconProps) {
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
        d="M9.375 17.75a3.125 3.125 0 1 0-6.25.002 3.125 3.125 0 0 0 6.25-.002m.59-15.794c1-1.489 3.247-1.44 4.164.148l3.079 5.333c.946 1.64-.236 3.687-2.128 3.687H8.92c-1.892 0-3.076-2.048-2.13-3.687l3.08-5.333.093-.148Zm2.216 1.273a.208.208 0 0 0-.325-.045l-.037.045-3.08 5.333a.21.21 0 0 0 .182.313h6.159c.16 0 .26-.174.18-.313L12.18 3.23Zm-.555 14.521a5.375 5.375 0 1 1-10.751-.002 5.375 5.375 0 0 1 10.75.002Zm9.249-2.5a.125.125 0 0 0-.125-.125h-5a.125.125 0 0 0-.125.124v5.001c0 .07.056.125.124.125h5.001a.125.125 0 0 0 .125-.125zm2.25 5a2.375 2.375 0 0 1-2.375 2.375h-5a2.375 2.375 0 0 1-2.375-2.375v-5a2.375 2.375 0 0 1 2.374-2.375h5.001a2.375 2.375 0 0 1 2.375 2.374z"
      />
    </svg>
  );
}
