import type { SVGProps } from "react";
export interface Dispenser01IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Dispenser01Icon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Dispenser01IconProps) {
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
        d="m19 13.876.115.005a1.125 1.125 0 0 1 0 2.239l-.115.005H5a1.125 1.125 0 0 1 0-2.25zM15.624 8a1.125 1.125 0 0 1-2.25 0v-.875h-2.749V8a1.125 1.125 0 0 1-2.25 0V6.5c0-.897.727-1.624 1.625-1.625h.876v-1.75h-1.61l-1.763.882-.105.045a1.126 1.126 0 0 1-.9-2.058l1.893-.948.173-.074q.267-.097.554-.097H15l.114.006a1.125 1.125 0 0 1 0 2.238L15 3.125h-1.875v1.75H14c.898 0 1.624.728 1.624 1.625z"
      />
      <path
        fill={color}
        d="M17.875 13A3.875 3.875 0 0 0 14 9.124h-4a3.875 3.875 0 0 0-3.875 3.874v6c0 1.036.84 1.876 1.875 1.876h8c1.035 0 1.875-.84 1.875-1.875zm2.25 6a4.125 4.125 0 0 1-4.126 4.125H8A4.125 4.125 0 0 1 3.875 19v-6A6.125 6.125 0 0 1 10 6.874h4a6.125 6.125 0 0 1 6.125 6.124v6Z"
      />
    </svg>
  );
}
