import type { SVGProps } from "react";
export interface ElestioLogoIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ElestioLogoIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ElestioLogoIconProps) {
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
        id="elestio-logo_svg__a"
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
          fill="#000"
          d="M14.543 16.983a6.8 6.8 0 0 1-2.818.618c-2.268 0-4.261-1.409-4.948-3.608h14.57c.103-.722.24-1.409.24-2.13 0-5.258-4.26-9.863-9.621-9.863C6.33 2 2 6.57 2 12.137 2 17.602 6.433 22 11.897 22c2.44 0 4.845-.997 6.598-2.577zM11.93 6.433c2.303 0 4.365 1.34 5.12 3.608H6.709c.687-2.2 2.99-3.608 5.223-3.608Z"
        />
      </mask>
      <g mask="url(#elestio-logo_svg__a)">
        <path fill="#A91A1F" d="M18.495 8.736H6.124v6.185h12.37V8.736Z" />
        <path
          fill="url(#elestio-logo_svg__b)"
          d="M11.921 6.444c.141 0 .282 0 .388.035L7.37 2.893a8 8 0 0 0-1.481.914c-3.175 2.32-4.657 6.083-4.128 9.74l5.394-3.78C8 7.691 9.558 6.443 11.92 6.443Z"
        />
        <path
          fill="url(#elestio-logo_svg__c)"
          d="M6.461 12.031c0-.793.221-1.547.522-2.264-1.615 1.17-3.712 2.68-5.327 3.85.075.603.226 1.207.413 1.81a10.82 10.82 0 0 0 8.522 7.398 459 459 0 0 1-1.99-6.227c-1.314-1.057-2.14-2.718-2.14-4.567"
        />
        <path
          fill="url(#elestio-logo_svg__d)"
          d="M14.809 16.783a5.7 5.7 0 0 1-2.975.834 5.64 5.64 0 0 1-3.648-1.321l1.877 5.703a9.5 9.5 0 0 0 1.735.139c3.967 0 7.367-2.191 9.102-5.39h-6.09z"
        />
        <path
          fill="url(#elestio-logo_svg__e)"
          d="m17.116 10.587 1.822-5.67c-.378-.412-.825-.756-1.272-1.1a9.94 9.94 0 0 0-10.275-.893l4.811 3.505c2.406.206 4.364 1.89 4.914 4.158"
        />
        <path
          fill="url(#elestio-logo_svg__f)"
          d="m19.393 3.378-2.547 6.233c.144.454.24.945.24 1.436 0 2.153-1.442 4.042-3.605 5.1h8.316c.384-.53.672-1.134.913-1.7 1.586-4.042.144-8.273-3.317-11.069"
        />
      </g>
      <defs>
        <linearGradient
          id="elestio-logo_svg__b"
          x1={6.985}
          x2={6.985}
          y1={13.507}
          y2={2.887}
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#EC5A22" />
          <stop offset={1} stopColor="#F5A11A" />
        </linearGradient>
        <linearGradient
          id="elestio-logo_svg__c"
          x1={6.133}
          x2={6.133}
          y1={22.84}
          y2={9.775}
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#BF161C" />
          <stop offset={1} stopColor="#E81C24" />
        </linearGradient>
        <linearGradient
          id="elestio-logo_svg__d"
          x1={14.586}
          x2={14.586}
          y1={22.191}
          y2={16.326}
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#8C278A" />
          <stop offset={1} stopColor="#A567A5" />
        </linearGradient>
        <linearGradient
          id="elestio-logo_svg__e"
          x1={13.174}
          x2={13.174}
          y1={10.598}
          y2={1.924}
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#F28E1E" />
          <stop offset={1} stopColor="#FFC605" />
        </linearGradient>
        <linearGradient
          id="elestio-logo_svg__f"
          x1={18.365}
          x2={18.365}
          y1={16.125}
          y2={3.363}
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#00A9EA" />
          <stop offset={1} stopColor="#6DCAF1" />
        </linearGradient>
      </defs>
    </svg>
  );
}
