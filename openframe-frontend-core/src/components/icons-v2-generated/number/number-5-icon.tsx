import type { SVGProps } from "react";
export interface Number5IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Number5Icon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: Number5IconProps) {
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
        d="M15.375 15.5v-1c0-1.832-1.505-3.375-3.375-3.375-1.662 0-2.853.809-3.998 1.381a1.125 1.125 0 0 1-1.624-1.08l.466-7.036.001-.006.02-.157a1.625 1.625 0 0 1 1.6-1.352H15.5l.116.006a1.125 1.125 0 0 1 0 2.238l-.116.006H9.05l-.297 4.482c.886-.385 1.99-.732 3.248-.732 3.13 0 5.625 2.568 5.625 5.625v1A5.607 5.607 0 0 1 12 21.126c-2.44 0-4.818-1.58-5.57-3.889l1.07-.347 1.07-.348c.421 1.297 1.87 2.334 3.43 2.334a3.357 3.357 0 0 0 3.375-3.374Zm-8.224.32a1.125 1.125 0 0 1 1.418.72l-2.138.696c-.192-.59.13-1.224.72-1.416"
      />
    </svg>
  );
}
