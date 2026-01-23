import type { SVGProps } from "react";
export interface Number2IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Number2Icon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: Number2IconProps) {
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
        d="M6.375 18c0-1.663.778-2.834 1.816-3.688.978-.803 2.252-1.378 3.333-1.882 1.152-.537 2.124-1.012 2.826-1.63.644-.569 1.025-1.227 1.025-2.2v-.1c0-1.832-1.505-3.375-3.375-3.375-1.56 0-3.009 1.038-3.43 2.335a1.125 1.125 0 0 1-2.14-.697c.752-2.31 3.13-3.888 5.57-3.888 3.13 0 5.625 2.568 5.625 5.625v.1c0 1.726-.745 2.968-1.787 3.887-.986.87-2.264 1.47-3.362 1.982-1.17.546-2.145.997-2.855 1.58-.649.534-.996 1.113-.996 1.95v.877H16.5l.116.005a1.125 1.125 0 0 1 0 2.239l-.116.005H8A1.626 1.626 0 0 1 6.375 19.5z"
      />
    </svg>
  );
}
