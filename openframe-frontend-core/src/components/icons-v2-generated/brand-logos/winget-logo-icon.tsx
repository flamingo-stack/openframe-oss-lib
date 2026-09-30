import type { SVGProps } from "react";
export interface WingetLogoIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function WingetLogoIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: WingetLogoIconProps) {
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
        fill="url(#winget-logo_svg__a)"
        d="M18.249 2H5.75c-.69 0-1.25.56-1.25 1.25v12.497c0 .69.56 1.25 1.25 1.25H18.25c.69 0 1.25-.56 1.25-1.25V3.25c0-.69-.56-1.25-1.25-1.25"
      />
      <path
        fill="url(#winget-logo_svg__b)"
        d="M19.498 4.516H4.501c-.69 0-1.25.56-1.25 1.25v12.497c0 .69.56 1.25 1.25 1.25h14.997c.69 0 1.25-.56 1.25-1.25V5.766c0-.69-.56-1.25-1.25-1.25"
      />
      <path
        fill="url(#winget-logo_svg__c)"
        d="M20.748 7.003H3.252c-.69 0-1.25.56-1.25 1.25V20.75c0 .69.56 1.25 1.25 1.25h17.496c.69 0 1.25-.56 1.25-1.25V8.253c0-.69-.56-1.25-1.25-1.25"
      />
      <path
        fill="url(#winget-logo_svg__d)"
        d="M10.78 10.697a1.25 1.25 0 1 1 2.499 0v4.556l.99-.99a1.25 1.25 0 0 1 1.768 1.766l-3.073 3.074a1 1 0 0 1-.106.106l-.829.829-.829-.83a1 1 0 0 1-.106-.105L8.02 16.029a1.25 1.25 0 1 1 1.767-1.767l.991.991z"
      />
      <path
        fill="url(#winget-logo_svg__e)"
        d="M4.501 3.346h14.996v1.169H4.501z"
      />
      <path
        fill="url(#winget-logo_svg__f)"
        d="M3.253 5.834h17.493v1.169H3.253z"
      />
      <defs>
        <linearGradient
          id="winget-logo_svg__a"
          x1={7.107}
          x2={16.893}
          y1={1.024}
          y2={17.974}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset={0.079} stopColor="#9C640A" />
          <stop offset={0.315} stopColor="#9F680F" />
          <stop offset={0.604} stopColor="#A9731E" />
          <stop offset={0.908} stopColor="#BA8636" />
        </linearGradient>
        <linearGradient
          id="winget-logo_svg__b"
          x1={6.794}
          x2={17.205}
          y1={2.998}
          y2={21.031}
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#BC822A" />
          <stop offset={0.908} stopColor="#BA8636" />
        </linearGradient>
        <linearGradient
          id="winget-logo_svg__c"
          x1={6.482}
          x2={17.518}
          y1={4.944}
          y2={24.059}
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#DCB374" />
          <stop offset={0.908} stopColor="#BA8636" />
        </linearGradient>
        <linearGradient
          id="winget-logo_svg__d"
          x1={12.029}
          x2={12.029}
          y1={9.447}
          y2={19.524}
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#FEFEFE" />
          <stop offset={0.559} stopColor="#F8F8F8" />
          <stop offset={1} stopColor="#F0F0F0" />
        </linearGradient>
        <linearGradient
          id="winget-logo_svg__e"
          x1={11.999}
          x2={11.999}
          y1={3.346}
          y2={4.515}
          gradientUnits="userSpaceOnUse"
        >
          <stop stopOpacity={0} />
          <stop offset={1} stopOpacity={0.26} />
        </linearGradient>
        <linearGradient
          id="winget-logo_svg__f"
          x1={12}
          x2={12}
          y1={5.834}
          y2={7.003}
          gradientUnits="userSpaceOnUse"
        >
          <stop stopOpacity={0} />
          <stop offset={1} stopOpacity={0.26} />
        </linearGradient>
      </defs>
    </svg>
  );
}
