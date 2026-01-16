import type { SVGProps } from "react";
export interface CampgroundIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CampgroundIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: CampgroundIconProps) {
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
        d="M9.634 15.759a3.125 3.125 0 0 1 4.852.149l3.358 4.41.066.096a1.125 1.125 0 0 1-1.78 1.355l-.076-.088-3.358-4.41a.876.876 0 0 0-1.323-.081l-.07.08-3.358 4.411a1.125 1.125 0 0 1-1.79-1.362l3.359-4.411.12-.15Z"
      />
      <path
        fill={color}
        d="M13.094 1.333a1.125 1.125 0 0 1 1.813 1.333l-1.514 2.06 9.118 12.425c1.515 2.063.043 4.974-2.518 4.974H3.998c-2.56 0-4.032-2.911-2.518-4.974l9.122-12.43-1.509-2.055-.063-.096a1.125 1.125 0 0 1 1.803-1.324l.074.087 1.092 1.489zm-9.8 17.15a.875.875 0 0 0 .704 1.392h15.995a.875.875 0 0 0 .705-1.393L11.995 6.624 3.294 18.482Z"
      />
    </svg>
  );
}
