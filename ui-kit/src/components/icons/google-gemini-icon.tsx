import React from 'react'

interface GoogleGeminiIconProps {
  className?: string
  size?: number
  color?: string
}

export function GoogleGeminiIcon({
  className = '',
  size = 24,
  color = 'white'
}: GoogleGeminiIconProps) {
  return (
    <svg 
      width={size}
      height={size} 
      viewBox="0 0 16 16" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <mask id="mask0_1860_11037" maskUnits="userSpaceOnUse" x="1" y="1" width="14" height="14">
        <path d="M7.98914 1.33331C8.12863 1.33331 8.25027 1.4287 8.28432 1.56408C8.38838 1.97816 8.5255 2.38322 8.69437 2.77536C9.13581 3.80101 9.74155 4.69865 10.5106 5.46767C11.28 6.2369 12.1774 6.84265 13.2029 7.28408C13.5951 7.4529 14.0002 7.59002 14.4144 7.69413C14.5498 7.72819 14.6449 7.84962 14.6449 7.98911C14.6449 8.1286 14.5498 8.25024 14.4142 8.28429C14.0001 8.38835 13.595 8.52547 13.2029 8.69434C12.1772 9.13577 11.2798 9.74152 10.5106 10.5105C9.74155 11.28 9.13581 12.1774 8.69437 13.2029C8.52548 13.5951 8.38829 14.0002 8.28411 14.4143C8.26763 14.4801 8.22966 14.5385 8.17623 14.5803C8.1228 14.6221 8.05696 14.6448 7.98914 14.6449C7.84965 14.6449 7.72822 14.5497 7.69416 14.4141C7.59003 14.0001 7.45284 13.595 7.28391 13.2029C6.84268 12.1772 6.23714 11.2798 5.4677 10.5105C4.69847 9.74152 3.80104 9.13577 2.77539 8.69434C2.38324 8.52546 1.97818 8.38827 1.56411 8.28408C1.49833 8.26764 1.4399 8.22972 1.3981 8.17633C1.3563 8.12294 1.33351 8.05712 1.33334 7.98931C1.33334 7.84983 1.42873 7.72839 1.56411 7.69434C1.9782 7.59021 2.38326 7.45302 2.77539 7.28408C3.80104 6.84285 4.69868 6.23711 5.4677 5.46788C6.23693 4.69885 6.84268 3.80121 7.28411 2.77557C7.45292 2.38341 7.59005 1.97835 7.69416 1.56429C7.71057 1.49843 7.74851 1.43994 7.80194 1.39809C7.85538 1.35625 7.92127 1.33345 7.98914 1.33331Z" fill="black" />
        <path d="M7.98914 1.33331C8.12863 1.33331 8.25027 1.4287 8.28432 1.56408C8.38838 1.97816 8.5255 2.38322 8.69437 2.77536C9.13581 3.80101 9.74155 4.69865 10.5106 5.46767C11.28 6.2369 12.1774 6.84265 13.2029 7.28408C13.5951 7.4529 14.0002 7.59002 14.4144 7.69413C14.5498 7.72819 14.6449 7.84962 14.6449 7.98911C14.6449 8.1286 14.5498 8.25024 14.4142 8.28429C14.0001 8.38835 13.595 8.52547 13.2029 8.69434C12.1772 9.13577 11.2798 9.74152 10.5106 10.5105C9.74155 11.28 9.13581 12.1774 8.69437 13.2029C8.52548 13.5951 8.38829 14.0002 8.28411 14.4143C8.26763 14.4801 8.22966 14.5385 8.17623 14.5803C8.1228 14.6221 8.05696 14.6448 7.98914 14.6449C7.84965 14.6449 7.72822 14.5497 7.69416 14.4141C7.59003 14.0001 7.45284 13.595 7.28391 13.2029C6.84268 12.1772 6.23714 11.2798 5.4677 10.5105C4.69847 9.74152 3.80104 9.13577 2.77539 8.69434C2.38324 8.52546 1.97818 8.38827 1.56411 8.28408C1.49833 8.26764 1.4399 8.22972 1.3981 8.17633C1.3563 8.12294 1.33351 8.05712 1.33334 7.98931C1.33334 7.84983 1.42873 7.72839 1.56411 7.69434C1.9782 7.59021 2.38326 7.45302 2.77539 7.28408C3.80104 6.84285 4.69868 6.23711 5.4677 5.46788C6.23693 4.69885 6.84268 3.80121 7.28411 2.77557C7.45292 2.38341 7.59005 1.97835 7.69416 1.56429C7.71057 1.49843 7.74851 1.43994 7.80194 1.39809C7.85538 1.35625 7.92127 1.33345 7.98914 1.33331Z" fill="url(#paint0_linear_1860_11037)" />
      </mask>
      <g mask="url(#mask0_1860_11037)">
        <g filter="url(#filter0_f_1860_11037)">
          <path d="M0.131409 11.7402C1.66946 12.2865 3.43725 11.2623 4.07992 9.45265C4.72259 7.64321 3.99664 5.73347 2.45859 5.18721C0.920537 4.64096 -0.847258 5.66516 -1.49013 7.4746C-2.13259 9.28424 -1.40664 11.194 0.131409 11.7402Z" fill={color} />
        </g>
        <g filter="url(#filter1_f_1860_11037)">
          <path d="M6.96053 5.77411C9.07335 5.77411 10.7864 4.02334 10.7864 1.86395C10.7864 -0.295639 9.07356 -2.0462 6.96053 -2.0462C4.84751 -2.0462 3.13428 -0.295434 3.13428 1.86395C3.13428 4.02334 4.8473 5.77411 6.96053 5.77411Z" fill={color} />
        </g>
        <g filter="url(#filter2_f_1860_11037)">
          <path d="M5.47351 18.2785C7.67925 18.1708 9.35412 15.7669 9.21443 12.9095C9.07494 10.0521 7.1734 7.82292 4.96766 7.93082C2.76192 8.03872 1.08705 10.4424 1.22674 13.2998C1.36643 16.1573 3.26776 18.3864 5.47351 18.2785Z" fill={color} />
        </g>
        <g filter="url(#filter3_f_1860_11037)">
          <path d="M5.47351 18.2785C7.67925 18.1708 9.35412 15.7669 9.21443 12.9095C9.07494 10.0521 7.1734 7.82292 4.96766 7.93082C2.76192 8.03872 1.08705 10.4424 1.22674 13.2998C1.36643 16.1573 3.26776 18.3864 5.47351 18.2785Z" fill={color} />
        </g>
        <g filter="url(#filter4_f_1860_11037)">
          <path d="M7.68278 16.5499C9.5318 15.4248 10.0268 12.8625 8.78821 10.8268C7.54965 8.79095 5.04647 8.0527 3.19724 9.17762C1.34801 10.303 0.853033 12.8652 2.0916 14.9011C3.33057 16.9368 5.83355 17.6751 7.68278 16.5499Z" fill={color} />
        </g>
        <g filter="url(#filter5_f_1860_11037)">
          <path d="M15.1571 10.1523C17.2354 10.1523 18.9203 8.52977 18.9203 6.52854C18.9203 4.52711 17.2354 2.90454 15.1571 2.90454C13.0787 2.90454 11.3938 4.52711 11.3938 6.52854C11.3938 8.52998 13.0787 10.1523 15.1571 10.1523Z" fill={color} />
        </g>
        <g filter="url(#filter6_f_1860_11037)">
          <path d="M-1.34674 9.73204C0.567106 11.1872 3.3628 10.7308 4.89777 8.71214C6.43275 6.69368 6.12587 3.87747 4.21203 2.42229C2.29818 0.966909 -0.497305 1.42332 -2.03248 3.44199C-3.56746 5.46045 -3.26038 8.27686 -1.34674 9.73204Z" fill={color} />
        </g>
        <g filter="url(#filter7_f_1860_11037)">
          <path d="M8.45937 11.883C10.7435 13.4535 13.7714 13.0161 15.222 10.9058C16.6729 8.79563 15.9972 5.81204 13.7129 4.24158C11.4286 2.67071 8.40091 3.10845 6.95004 5.2184C5.49937 7.32876 6.17486 10.3123 8.45916 11.883H8.45937Z" fill={color} />
        </g>
        <g filter="url(#filter8_f_1860_11037)">
          <path d="M12.612 0.854111C13.1932 1.64426 12.4463 3.18026 10.9441 4.28529C9.44178 5.39032 7.75296 5.64549 7.17183 4.85555C6.5907 4.06519 7.33737 2.52898 8.83952 1.42416C10.3419 0.319137 12.0309 0.0639571 12.6118 0.853906L12.612 0.854111Z" fill={color} />
        </g>
        <g filter="url(#filter9_f_1860_11037)">
          <path d="M7.84139 4.63669C10.1647 2.48162 10.962 -0.436126 9.62252 -1.88023C8.28303 -3.32433 5.3136 -2.74833 2.99032 -0.593255C0.667033 1.56182 -0.130505 4.47957 1.20919 5.92367C2.54867 7.36777 5.51811 6.79177 7.84139 4.63669Z" fill={color} />
        </g>
        <g filter="url(#filter10_f_1860_11037)">
          <path d="M3.07886 12.377C4.45979 13.3653 6.04502 13.5155 6.61979 12.7126C7.19456 11.9095 6.54102 10.4574 5.16009 9.46911C3.77938 8.4808 2.19394 8.33065 1.61938 9.13352C1.04461 9.9366 1.69794 11.3887 3.07886 12.377Z" fill={color} />
        </g>
      </g>
      <defs>
        <filter id="filter0_f_1860_11037" x="-3.23797" y="3.52644" width="9.06584" height="9.87456" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur stdDeviation="0.756923" result="effect1_foregroundBlur_1860_11037" />
        </filter>
        <filter id="filter1_f_1860_11037" x="-4.18326" y="-9.36374" width="22.2872" height="22.4554" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur stdDeviation="3.65877" result="effect1_foregroundBlur_1860_11037" />
        </filter>
        <filter id="filter2_f_1860_11037" x="-5.00233" y="1.70614" width="20.4458" height="22.7971" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur stdDeviation="3.11046" result="effect1_foregroundBlur_1860_11037" />
        </filter>
        <filter id="filter3_f_1860_11037" x="-5.00233" y="1.70614" width="20.4458" height="22.7971" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur stdDeviation="3.11046" result="effect1_foregroundBlur_1860_11037" />
        </filter>
        <filter id="filter4_f_1860_11037" x="-4.81141" y="2.43057" width="20.5026" height="20.8666" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur stdDeviation="3.11046" result="effect1_foregroundBlur_1860_11037" />
        </filter>
        <filter id="filter5_f_1860_11037" x="5.48238" y="-3.00684" width="19.3493" height="19.0706" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur stdDeviation="2.95569" result="effect1_foregroundBlur_1860_11037" />
        </filter>
        <filter id="filter6_f_1860_11037" x="-8.36709" y="-3.78655" width="19.5995" height="19.7273" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur stdDeviation="2.67877" result="effect1_foregroundBlur_1860_11037" />
        </filter>
        <filter id="filter7_f_1860_11037" x="1.40114" y="-1.4856" width="19.3699" height="19.0956" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur stdDeviation="2.39231" result="effect1_foregroundBlur_1860_11037" />
        </filter>
        <filter id="filter8_f_1860_11037" x="2.69338" y="-3.88627" width="14.3971" height="13.482" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur stdDeviation="2.14062" result="effect1_foregroundBlur_1860_11037" />
        </filter>
        <filter id="filter9_f_1860_11037" x="-3.05686" y="-6.2919" width="16.9453" height="16.6273" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur stdDeviation="1.808" result="effect1_foregroundBlur_1860_11037" />
        </filter>
        <filter id="filter10_f_1860_11037" x="-3.06499" y="4.14162" width="14.3691" height="13.5629" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur stdDeviation="2.23785" result="effect1_foregroundBlur_1860_11037" />
        </filter>
        <linearGradient id="paint0_linear_1860_11037" x1="5.11734" y1="10.24" x2="12.0314" y2="4.41106" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4893FC" />
          <stop offset="0.27" stopColor="#4893FC" />
          <stop offset="0.777" stopColor="#969DFF" />
          <stop offset="1" stopColor="#BD99FE" />
        </linearGradient>
      </defs>
    </svg>
  )
}
