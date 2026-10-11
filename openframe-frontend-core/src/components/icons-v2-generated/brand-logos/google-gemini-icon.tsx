import type { SVGProps } from "react";
export interface GoogleGeminiIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function GoogleGeminiIcon({
  className = "",
  size = 24,
  color = "var(--color-text-primary)",
  ...props
}: GoogleGeminiIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 16 16"
      width={size}
      height={size}
      className={className}
      {...props}
    >
      <mask
        id="google-gemini_svg__b"
        width={14}
        height={14}
        x={1}
        y={1}
        maskUnits="userSpaceOnUse"
      >
        <path
          fill="#000"
          d="M7.99 1.333c.139 0 .26.096.294.231q.156.623.41 1.211a8.6 8.6 0 0 0 1.817 2.693 8.55 8.55 0 0 0 3.903 2.226.304.304 0 0 1 0 .59q-.622.156-1.211.41a8.6 8.6 0 0 0-2.692 1.816 8.55 8.55 0 0 0-2.227 3.904.305.305 0 0 1-.59 0 8.54 8.54 0 0 0-2.226-3.904 8.55 8.55 0 0 0-3.904-2.226.305.305 0 0 1 0-.59 8.54 8.54 0 0 0 3.904-2.226 8.54 8.54 0 0 0 2.226-3.904.305.305 0 0 1 .295-.23"
        />
        <path
          fill="url(#google-gemini_svg__a)"
          d="M7.99 1.333c.139 0 .26.096.294.231q.156.623.41 1.211a8.6 8.6 0 0 0 1.817 2.693 8.55 8.55 0 0 0 3.903 2.226.304.304 0 0 1 0 .59q-.622.156-1.211.41a8.6 8.6 0 0 0-2.692 1.816 8.55 8.55 0 0 0-2.227 3.904.305.305 0 0 1-.59 0 8.54 8.54 0 0 0-2.226-3.904 8.55 8.55 0 0 0-3.904-2.226.305.305 0 0 1 0-.59 8.54 8.54 0 0 0 3.904-2.226 8.54 8.54 0 0 0 2.226-3.904.305.305 0 0 1 .295-.23"
        />
      </mask>
      <g mask="url(#google-gemini_svg__b)">
        <g filter="url(#google-gemini_svg__c)">
          <path
            fill={color}
            d="M.131 11.74c1.538.547 3.306-.478 3.949-2.287.643-1.81-.083-3.72-1.621-4.266s-3.306.478-3.95 2.288c-.642 1.81.084 3.719 1.622 4.265"
          />
        </g>
        <g filter="url(#google-gemini_svg__d)">
          <path
            fill={color}
            d="M6.96 5.774c2.113 0 3.826-1.75 3.826-3.91s-1.712-3.91-3.825-3.91-3.827 1.75-3.827 3.91 1.713 3.91 3.827 3.91"
          />
        </g>
        <g filter="url(#google-gemini_svg__e)">
          <path
            fill={color}
            d="M5.474 18.279c2.205-.108 3.88-2.512 3.74-5.37s-2.04-5.086-4.246-4.978-3.881 2.511-3.741 5.369 2.04 5.086 4.247 4.979"
          />
        </g>
        <g filter="url(#google-gemini_svg__f)">
          <path
            fill={color}
            d="M5.474 18.279c2.205-.108 3.88-2.512 3.74-5.37s-2.04-5.086-4.246-4.978-3.881 2.511-3.741 5.369 2.04 5.086 4.247 4.979"
          />
        </g>
        <g filter="url(#google-gemini_svg__g)">
          <path
            fill={color}
            d="M7.683 16.55c1.849-1.125 2.344-3.687 1.105-5.723s-3.742-2.774-5.59-1.65c-1.85 1.126-2.345 3.688-1.106 5.724s3.742 2.774 5.59 1.649"
          />
        </g>
        <g filter="url(#google-gemini_svg__h)">
          <path
            fill={color}
            d="M15.157 10.152c2.078 0 3.763-1.622 3.763-3.623s-1.685-3.624-3.763-3.624-3.763 1.622-3.763 3.624 1.685 3.623 3.763 3.623"
          />
        </g>
        <g filter="url(#google-gemini_svg__i)">
          <path
            fill={color}
            d="M-1.347 9.732c1.914 1.455 4.71.999 6.245-1.02 1.535-2.018 1.228-4.835-.686-6.29s-4.71-.999-6.244 1.02c-1.535 2.018-1.228 4.835.685 6.29"
          />
        </g>
        <g filter="url(#google-gemini_svg__j)">
          <path
            fill={color}
            d="M8.46 11.883c2.283 1.57 5.311 1.133 6.762-.977s.775-5.094-1.51-6.664C11.43 2.67 8.402 3.108 6.95 5.218s-.775 5.094 1.51 6.665"
          />
        </g>
        <g filter="url(#google-gemini_svg__k)">
          <path
            fill={color}
            d="M12.612.854c.581.79-.166 2.326-1.668 3.431s-3.191 1.36-3.772.57.165-2.326 1.668-3.43C10.342.318 12.03.063 12.612.853"
          />
        </g>
        <g filter="url(#google-gemini_svg__l)">
          <path
            fill={color}
            d="M7.841 4.637c2.324-2.155 3.121-5.073 1.782-6.517-1.34-1.444-4.31-.868-6.633 1.287S-.13 4.48 1.21 5.924c1.339 1.444 4.308.868 6.631-1.287"
          />
        </g>
        <g filter="url(#google-gemini_svg__m)">
          <path
            fill={color}
            d="M3.079 12.377c1.38.988 2.966 1.138 3.54.336.576-.803-.078-2.256-1.459-3.244-1.38-.988-2.966-1.138-3.54-.335-.575.803.078 2.255 1.459 3.243"
          />
        </g>
      </g>
      <defs>
        <filter
          id="google-gemini_svg__c"
          width={9.066}
          height={9.875}
          x={-3.238}
          y={3.526}
          colorInterpolationFilters="sRGB"
          filterUnits="userSpaceOnUse"
        >
          <feFlood floodOpacity={0} result="BackgroundImageFix" />
          <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur
            result="effect1_foregroundBlur_1860_11037"
            stdDeviation={0.757}
          />
        </filter>
        <filter
          id="google-gemini_svg__d"
          width={22.287}
          height={22.455}
          x={-4.183}
          y={-9.364}
          colorInterpolationFilters="sRGB"
          filterUnits="userSpaceOnUse"
        >
          <feFlood floodOpacity={0} result="BackgroundImageFix" />
          <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur
            result="effect1_foregroundBlur_1860_11037"
            stdDeviation={3.659}
          />
        </filter>
        <filter
          id="google-gemini_svg__e"
          width={20.446}
          height={22.797}
          x={-5.002}
          y={1.706}
          colorInterpolationFilters="sRGB"
          filterUnits="userSpaceOnUse"
        >
          <feFlood floodOpacity={0} result="BackgroundImageFix" />
          <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur
            result="effect1_foregroundBlur_1860_11037"
            stdDeviation={3.11}
          />
        </filter>
        <filter
          id="google-gemini_svg__f"
          width={20.446}
          height={22.797}
          x={-5.002}
          y={1.706}
          colorInterpolationFilters="sRGB"
          filterUnits="userSpaceOnUse"
        >
          <feFlood floodOpacity={0} result="BackgroundImageFix" />
          <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur
            result="effect1_foregroundBlur_1860_11037"
            stdDeviation={3.11}
          />
        </filter>
        <filter
          id="google-gemini_svg__g"
          width={20.503}
          height={20.867}
          x={-4.811}
          y={2.431}
          colorInterpolationFilters="sRGB"
          filterUnits="userSpaceOnUse"
        >
          <feFlood floodOpacity={0} result="BackgroundImageFix" />
          <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur
            result="effect1_foregroundBlur_1860_11037"
            stdDeviation={3.11}
          />
        </filter>
        <filter
          id="google-gemini_svg__h"
          width={19.349}
          height={19.071}
          x={5.482}
          y={-3.007}
          colorInterpolationFilters="sRGB"
          filterUnits="userSpaceOnUse"
        >
          <feFlood floodOpacity={0} result="BackgroundImageFix" />
          <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur
            result="effect1_foregroundBlur_1860_11037"
            stdDeviation={2.956}
          />
        </filter>
        <filter
          id="google-gemini_svg__i"
          width={19.599}
          height={19.727}
          x={-8.367}
          y={-3.787}
          colorInterpolationFilters="sRGB"
          filterUnits="userSpaceOnUse"
        >
          <feFlood floodOpacity={0} result="BackgroundImageFix" />
          <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur
            result="effect1_foregroundBlur_1860_11037"
            stdDeviation={2.679}
          />
        </filter>
        <filter
          id="google-gemini_svg__j"
          width={19.37}
          height={19.096}
          x={1.401}
          y={-1.486}
          colorInterpolationFilters="sRGB"
          filterUnits="userSpaceOnUse"
        >
          <feFlood floodOpacity={0} result="BackgroundImageFix" />
          <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur
            result="effect1_foregroundBlur_1860_11037"
            stdDeviation={2.392}
          />
        </filter>
        <filter
          id="google-gemini_svg__k"
          width={14.397}
          height={13.482}
          x={2.693}
          y={-3.886}
          colorInterpolationFilters="sRGB"
          filterUnits="userSpaceOnUse"
        >
          <feFlood floodOpacity={0} result="BackgroundImageFix" />
          <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur
            result="effect1_foregroundBlur_1860_11037"
            stdDeviation={2.141}
          />
        </filter>
        <filter
          id="google-gemini_svg__l"
          width={16.945}
          height={16.627}
          x={-3.057}
          y={-6.292}
          colorInterpolationFilters="sRGB"
          filterUnits="userSpaceOnUse"
        >
          <feFlood floodOpacity={0} result="BackgroundImageFix" />
          <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur
            result="effect1_foregroundBlur_1860_11037"
            stdDeviation={1.808}
          />
        </filter>
        <filter
          id="google-gemini_svg__m"
          width={14.369}
          height={13.563}
          x={-3.065}
          y={4.142}
          colorInterpolationFilters="sRGB"
          filterUnits="userSpaceOnUse"
        >
          <feFlood floodOpacity={0} result="BackgroundImageFix" />
          <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur
            result="effect1_foregroundBlur_1860_11037"
            stdDeviation={2.238}
          />
        </filter>
        <linearGradient
          id="google-gemini_svg__a"
          x1={5.117}
          x2={12.031}
          y1={10.24}
          y2={4.411}
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#4893FC" />
          <stop offset={0.27} stopColor="#4893FC" />
          <stop offset={0.777} stopColor="#969DFF" />
          <stop offset={1} stopColor="#BD99FE" />
        </linearGradient>
      </defs>
    </svg>
  );
}
