import type { SVGProps } from "react";
export interface PaypalIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function PaypalIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: PaypalIconProps) {
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
        d="M17.577 6.91c.245-.528.85-.776 1.388-.589l.107.044.378.195a5.28 5.28 0 0 1 2.659 5.007l-.056.454a6.11 6.11 0 0 1-6.025 5.103h-1.737a.376.376 0 0 0-.37.314l-.652 3.91a2.125 2.125 0 0 1-2.097 1.776H8.681a2.125 2.125 0 0 1-2.097-2.474v-.004l.288-1.672a1.124 1.124 0 1 1 2.217.38l-.26 1.52h2.238l.634-3.805.05-.233a2.626 2.626 0 0 1 2.54-1.962h1.737a3.86 3.86 0 0 0 3.806-3.224l.032-.26a3.03 3.03 0 0 0-1.525-2.873l-.218-.113-.103-.053a1.126 1.126 0 0 1-.443-1.441"
      />
      <path
        fill={color}
        d="M13.801.875c3.679 0 6.478 3.303 5.873 6.932a7.56 7.56 0 0 1-7.46 6.317H11.07a1.31 1.31 0 0 0-1.292 1.095l-.688 4.13a2.124 2.124 0 0 1-2.095 1.776H4a2.125 2.125 0 0 1-2.096-2.474L4.43 3.487l.06-.279A3.126 3.126 0 0 1 7.514.875zm-6.287 2.25c-.374 0-.7.237-.823.579l-.04.152-2.503 15.019h2.74l.67-4.025a3.56 3.56 0 0 1 3.511-2.976h1.146a5.31 5.31 0 0 0 5.24-4.438A3.703 3.703 0 0 0 13.8 3.125z"
      />
    </svg>
  );
}
