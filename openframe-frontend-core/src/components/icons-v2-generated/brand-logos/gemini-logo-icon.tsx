import { useId, type SVGProps } from "react";
export interface GeminiLogoIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function GeminiLogoIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: GeminiLogoIconProps) {
  const uid = useId();
  const idA = `gemini-logo_svg__a${uid}`;
  const idB = `gemini-logo_svg__b${uid}`;
  const idC = `gemini-logo_svg__c${uid}`;
  const idD = `gemini-logo_svg__d${uid}`;
  const idE = `gemini-logo_svg__e${uid}`;
  const idF = `gemini-logo_svg__f${uid}`;
  const idG = `gemini-logo_svg__g${uid}`;
  const idH = `gemini-logo_svg__h${uid}`;
  const idI = `gemini-logo_svg__i${uid}`;
  const idJ = `gemini-logo_svg__j${uid}`;
  const idK = `gemini-logo_svg__k${uid}`;
  const idL = `gemini-logo_svg__l${uid}`;
  const idM = `gemini-logo_svg__m${uid}`;
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
        id={idB}
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
          d="M11.984 2c.209 0 .391.143.443.346q.234.933.614 1.817a12.8 12.8 0 0 0 2.725 4.039 12.8 12.8 0 0 0 4.038 2.724 12 12 0 0 0 1.818.615.457.457 0 0 1 0 .886q-.934.234-1.818.614a12.8 12.8 0 0 0-4.038 2.725 12.83 12.83 0 0 0-3.34 5.856.46.46 0 0 1-.442.345.46.46 0 0 1-.443-.346 12.809 12.809 0 0 0-3.34-5.855 12.8 12.8 0 0 0-5.855-3.34.457.457 0 0 1 0-.885 12.812 12.812 0 0 0 5.855-3.34 12.8 12.8 0 0 0 3.34-5.855.46.46 0 0 1 .443-.346"
        />
        <path
          fill={`url(#${idA})`}
          d="M11.984 2c.209 0 .391.143.443.346q.234.933.614 1.817a12.8 12.8 0 0 0 2.725 4.039 12.8 12.8 0 0 0 4.038 2.724 12 12 0 0 0 1.818.615.457.457 0 0 1 0 .886q-.934.234-1.818.614a12.8 12.8 0 0 0-4.038 2.725 12.83 12.83 0 0 0-3.34 5.856.46.46 0 0 1-.442.345.46.46 0 0 1-.443-.346 12.809 12.809 0 0 0-3.34-5.855 12.8 12.8 0 0 0-5.855-3.34.457.457 0 0 1 0-.885 12.812 12.812 0 0 0 5.855-3.34 12.8 12.8 0 0 0 3.34-5.855.46.46 0 0 1 .443-.346"
        />
      </mask>
      <g mask={`url(#${idB})`}>
        <g filter={`url(#${idC})`}>
          <path
            fill="#FFE432"
            d="M.197 17.61c2.307.82 4.96-.716 5.923-3.43s-.125-5.58-2.432-6.4c-2.307-.818-4.959.718-5.923 3.432s.125 5.58 2.432 6.398"
          />
        </g>
        <g filter={`url(#${idD})`}>
          <path
            fill="#FC413D"
            d="M10.441 8.661c3.17 0 5.739-2.626 5.739-5.865s-2.57-5.865-5.739-5.865-5.74 2.626-5.74 5.865 2.57 5.865 5.74 5.865"
          />
        </g>
        <g filter={`url(#${idE})`}>
          <path
            fill="#00B95C"
            d="M8.21 27.418c3.31-.162 5.821-3.767 5.612-8.054-.21-4.286-3.062-7.63-6.37-7.468S1.63 15.664 1.84 19.95c.21 4.286 3.062 7.63 6.37 7.468"
          />
        </g>
        <g filter={`url(#${idF})`}>
          <path
            fill="#00B95C"
            d="M8.21 27.418c3.31-.162 5.821-3.767 5.612-8.054-.21-4.286-3.062-7.63-6.37-7.468S1.63 15.664 1.84 19.95c.21 4.286 3.062 7.63 6.37 7.468"
          />
        </g>
        <g filter={`url(#${idG})`}>
          <path
            fill="#00B95C"
            d="M11.524 24.825c2.774-1.688 3.516-5.531 1.658-8.585-1.857-3.054-5.612-4.161-8.386-2.474-2.774 1.688-3.516 5.532-1.659 8.586 1.859 3.053 5.613 4.16 8.387 2.473"
          />
        </g>
        <g filter={`url(#${idH})`}>
          <path
            fill="#3186FF"
            d="M22.736 15.229c3.117 0 5.645-2.434 5.645-5.436s-2.528-5.436-5.645-5.436c-3.118 0-5.645 2.434-5.645 5.436s2.527 5.436 5.645 5.436"
          />
        </g>
        <g filter={`url(#${idI})`}>
          <path
            fill="#FBBC04"
            d="M-2.02 14.598c2.87 2.183 7.064 1.498 9.367-1.53 2.302-3.027 1.842-7.252-1.029-9.434-2.87-2.184-7.064-1.499-9.367 1.53-2.302 3.027-1.841 7.251 1.03 9.434"
          />
        </g>
        <g filter={`url(#${idJ})`}>
          <path
            fill="#3186FF"
            d="M12.69 17.825c3.425 2.355 7.967 1.7 10.143-1.466s1.163-7.64-2.263-9.997c-3.427-2.356-7.969-1.7-10.145 1.466s-1.163 7.64 2.264 9.997"
          />
        </g>
        <g filter={`url(#${idK})`}>
          <path
            fill="#749BFF"
            d="M18.918 1.281c.872 1.185-.249 3.49-2.502 5.147s-4.787 2.04-5.658.855.248-3.49 2.501-5.147 4.787-2.04 5.659-.855"
          />
        </g>
        <g filter={`url(#${idL})`}>
          <path
            fill="#FC413D"
            d="M11.762 6.955c3.485-3.233 4.681-7.61 2.672-9.775S7.97-4.122 4.486-.89-.196 6.72 1.814 8.886s6.463 1.302 9.948-1.93"
          />
        </g>
        <g filter={`url(#${idM})`}>
          <path
            fill="#FFEE48"
            d="M4.618 18.566c2.072 1.482 4.45 1.707 5.312.503s-.118-3.383-2.19-4.865c-2.07-1.483-4.449-1.708-5.31-.504-.863 1.205.117 3.383 2.188 4.866"
          />
        </g>
      </g>
      <defs>
        <filter
          id={idC}
          width={12.085}
          height={13.298}
          x={-4.1}
          y={6.047}
          colorInterpolationFilters="sRGB"
          filterUnits="userSpaceOnUse"
        >
          <feFlood floodOpacity={0} result="BackgroundImageFix" />
          <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur
            result="effect1_foregroundBlur_983_149"
            stdDeviation={0.757}
          />
        </filter>
        <filter
          id={idD}
          width={26.113}
          height={26.366}
          x={-2.616}
          y={-10.387}
          colorInterpolationFilters="sRGB"
          filterUnits="userSpaceOnUse"
        >
          <feFlood floodOpacity={0} result="BackgroundImageFix" />
          <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur
            result="effect1_foregroundBlur_983_149"
            stdDeviation={3.659}
          />
        </filter>
        <filter
          id={idE}
          width={24.448}
          height={27.975}
          x={-4.393}
          y={5.67}
          colorInterpolationFilters="sRGB"
          filterUnits="userSpaceOnUse"
        >
          <feFlood floodOpacity={0} result="BackgroundImageFix" />
          <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur
            result="effect1_foregroundBlur_983_149"
            stdDeviation={3.11}
          />
        </filter>
        <filter
          id={idF}
          width={24.448}
          height={27.975}
          x={-4.393}
          y={5.67}
          colorInterpolationFilters="sRGB"
          filterUnits="userSpaceOnUse"
        >
          <feFlood floodOpacity={0} result="BackgroundImageFix" />
          <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur
            result="effect1_foregroundBlur_983_149"
            stdDeviation={3.11}
          />
        </filter>
        <filter
          id={idG}
          width={24.533}
          height={25.079}
          x={-4.107}
          y={6.756}
          colorInterpolationFilters="sRGB"
          filterUnits="userSpaceOnUse"
        >
          <feFlood floodOpacity={0} result="BackgroundImageFix" />
          <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur
            result="effect1_foregroundBlur_983_149"
            stdDeviation={3.11}
          />
        </filter>
        <filter
          id={idH}
          width={23.113}
          height={22.695}
          x={11.179}
          y={-1.554}
          colorInterpolationFilters="sRGB"
          filterUnits="userSpaceOnUse"
        >
          <feFlood floodOpacity={0} result="BackgroundImageFix" />
          <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur
            result="effect1_foregroundBlur_983_149"
            stdDeviation={2.956}
          />
        </filter>
        <filter
          id={idI}
          width={24.042}
          height={24.233}
          x={-9.872}
          y={-3.001}
          colorInterpolationFilters="sRGB"
          filterUnits="userSpaceOnUse"
        >
          <feFlood floodOpacity={0} result="BackgroundImageFix" />
          <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur
            result="effect1_foregroundBlur_983_149"
            stdDeviation={2.679}
          />
        </filter>
        <filter
          id={idJ}
          width={24.27}
          height={23.859}
          x={4.494}
          y={0.164}
          colorInterpolationFilters="sRGB"
          filterUnits="userSpaceOnUse"
        >
          <feFlood floodOpacity={0} result="BackgroundImageFix" />
          <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur
            result="effect1_foregroundBlur_983_149"
            stdDeviation={2.392}
          />
        </filter>
        <filter
          id={idK}
          width={17.314}
          height={15.942}
          x={6.181}
          y={-3.689}
          colorInterpolationFilters="sRGB"
          filterUnits="userSpaceOnUse"
        >
          <feFlood floodOpacity={0} result="BackgroundImageFix" />
          <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur
            result="effect1_foregroundBlur_983_149"
            stdDeviation={2.141}
          />
        </filter>
        <filter
          id={idL}
          width={21.802}
          height={21.325}
          x={-2.777}
          y={-7.63}
          colorInterpolationFilters="sRGB"
          filterUnits="userSpaceOnUse"
        >
          <feFlood floodOpacity={0} result="BackgroundImageFix" />
          <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur
            result="effect1_foregroundBlur_983_149"
            stdDeviation={1.808}
          />
        </filter>
        <filter
          id={idM}
          width={17.078}
          height={15.869}
          x={-2.359}
          y={8.45}
          colorInterpolationFilters="sRGB"
          filterUnits="userSpaceOnUse"
        >
          <feFlood floodOpacity={0} result="BackgroundImageFix" />
          <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur
            result="effect1_foregroundBlur_983_149"
            stdDeviation={2.238}
          />
        </filter>
        <linearGradient
          id={idA}
          x1={7.676}
          x2={18.047}
          y1={15.36}
          y2={6.617}
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
