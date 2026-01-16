import type { SVGProps } from "react";
export interface Number1IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Number1Icon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Number1IconProps) {
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
        d="M12.57 2.876c.593.038 1.055.53 1.055 1.124v14.875H17l.116.006a1.125 1.125 0 0 1 0 2.239l-.116.005H8a1.125 1.125 0 0 1 0-2.25h3.375V8.215a5.1 5.1 0 0 1-2.427.887l-.48.023H8a1.125 1.125 0 0 1 0-2.25h.469l.27-.013a2.876 2.876 0 0 0 2.583-2.506l.062-.495a1.126 1.126 0 0 1 1.186-.985"
      />
    </svg>
  );
}
