import type { SVGProps } from "react";
export interface ElestioLogoGreyIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ElestioLogoGreyIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ElestioLogoGreyIconProps) {
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
      <mask
        id="elestio-logo-grey_svg__a"
        width={20}
        height={20}
        x={2}
        y={2}
        maskUnits="userSpaceOnUse"
        style={{
          maskType: "alpha",
        }}
      >
        <path
          fill={color}
          d="M14.543 16.983a6.8 6.8 0 0 1-2.818.618c-2.268 0-4.261-1.409-4.948-3.608h14.57c.103-.722.24-1.409.24-2.13 0-5.258-4.26-9.863-9.621-9.863C6.33 2 2 6.57 2 12.138 2 17.6 6.433 22 11.897 22c2.44 0 4.845-.997 6.598-2.577zM11.93 6.433c2.303 0 4.365 1.34 5.12 3.608H6.709c.687-2.2 2.99-3.608 5.223-3.608"
        />
      </mask>
      <g fill={color} mask="url(#elestio-logo-grey_svg__a)">
        <path d="M18.495 8.736H6.124v6.185h12.37z" />
        <path d="M11.921 6.444c.141 0 .282 0 .388.035L7.37 2.893a8 8 0 0 0-1.481.914c-3.175 2.32-4.657 6.083-4.128 9.74l5.394-3.78C8 7.691 9.558 6.443 11.92 6.443" />
        <path d="M6.461 12.031c0-.793.221-1.547.522-2.264-1.615 1.17-3.712 2.68-5.327 3.85.075.603.226 1.207.413 1.81 1.277 4.001 4.655 6.756 8.522 7.398a459 459 0 0 1-1.99-6.227c-1.314-1.057-2.14-2.718-2.14-4.567" />
        <path d="M14.809 16.783a5.7 5.7 0 0 1-2.975.834 5.64 5.64 0 0 1-3.648-1.321l1.877 5.703a9.5 9.5 0 0 0 1.735.139c3.967 0 7.367-2.191 9.102-5.39H14.81zM17.116 10.587l1.822-5.67c-.378-.412-.825-.756-1.272-1.1a9.94 9.94 0 0 0-10.275-.893l4.811 3.505c2.406.206 4.364 1.89 4.914 4.158" />
        <path d="m19.393 3.378-2.547 6.233c.144.454.24.945.24 1.436 0 2.153-1.442 4.042-3.605 5.1h8.316c.384-.53.672-1.134.913-1.7 1.586-4.042.144-8.273-3.317-11.069" />
      </g>
    </svg>
  );
}
