import React from 'react';

/**
 * Official Elestio logo with unique IDs to prevent gradient/clip-path collisions
 * when the same SVG is rendered multiple times on the page.
 */
export const ElestioLogo = ({ className, ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) => {
  // Generate unique ID suffix to avoid ID collisions between instances
  const uniqueId = React.useId();

  return (
    <svg
      {...props}
      className={className}
      width="25"
      height="24"
      viewBox="0 0 25 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <mask
        id={`mask0_${uniqueId}`}
        style={{ maskType: 'alpha' }}
        maskUnits="userSpaceOnUse"
        x="2"
        y="2"
        width="21"
        height="20"
      >
        <path
          d="M15.0429 16.9829C14.2182 17.3609 13.256 17.6014 12.2251 17.6014C9.95706 17.6014 7.96393 16.1924 7.27664 13.9932H21.8471C21.9502 13.2715 22.0876 12.5842 22.0876 11.8626C22.0876 6.60479 17.8264 2 12.4657 2C6.8299 2 2.5 6.57045 2.5 12.1375C2.5 17.6014 6.933 22 12.3969 22C14.8368 22 17.2423 21.0034 18.9949 19.4227L15.0429 16.9829ZM12.4313 6.433C14.7337 6.433 16.7955 7.77325 17.5515 10.0413H7.20791C7.8952 7.84192 10.1976 6.433 12.4313 6.433Z"
          fill="black"
        />
      </mask>
      <g mask={`url(#mask0_${uniqueId})`}>
        <path d="M18.9942 8.73535H6.62305V14.9209H18.9942V8.73535Z" fill="#A91A1F" />
        <path d="M12.4211 6.4445C12.5622 6.4445 12.7034 6.4445 12.8092 6.47969L7.87043 2.89355C7.34128 3.13966 6.8474 3.45608 6.3888 3.80766C3.21389 6.12808 1.73227 9.89003 2.26142 13.5465L7.65454 9.76642C8.50118 7.69204 10.1976 6.4445 12.4211 6.4445Z" fill={`url(#paint0_linear_${uniqueId})`} />
        <path d="M6.96148 12.031C6.96148 11.2385 7.18239 10.4837 7.48272 9.7666C5.86846 10.9366 3.7705 12.4462 2.15625 13.6162C2.23133 14.2201 2.3815 14.8239 2.5692 15.4277C3.84559 19.4283 7.22426 22.1835 11.091 22.825C11.0159 22.5986 10.0398 19.617 9.1013 16.5978C7.78738 15.541 6.96148 13.8804 6.96148 12.031Z" fill={`url(#paint1_linear_${uniqueId})`} />
        <path d="M15.3086 16.7828C14.4586 17.3044 13.4314 17.6174 12.3335 17.6174C10.9523 17.6174 9.67724 17.1305 8.68555 16.2959L10.5627 21.9987C11.1293 22.1031 11.696 22.1379 12.2981 22.1379C16.2648 22.1379 19.665 19.9471 21.4004 16.748H15.3086V16.7828Z" fill={`url(#paint2_linear_${uniqueId})`} />
        <path d="M17.6157 10.5868L19.4371 4.9167C19.0591 4.50436 18.6123 4.1607 18.1656 3.81706C15.0728 1.54901 11.0865 1.34283 7.89062 2.92358L12.7016 6.42873C15.1072 6.63496 17.0659 8.31877 17.6157 10.5868Z" fill={`url(#paint3_linear_${uniqueId})`} />
        <path d="M19.8927 3.37793L17.3451 9.61093C17.4894 10.0644 17.5855 10.5554 17.5855 11.0466C17.5855 13.1998 16.1435 15.0887 13.9805 16.1463H22.296C22.6804 15.6174 22.969 15.013 23.2092 14.4464C24.7954 10.4043 23.3535 6.17334 19.8927 3.37793Z" fill={`url(#paint4_linear_${uniqueId})`} />
      </g>
      <defs>
        <linearGradient id={`paint0_linear_${uniqueId}`} x1="7.48507" y1="13.5074" x2="7.48507" y2="2.88726" gradientUnits="userSpaceOnUse">
          <stop stopColor="#EC5A22" />
          <stop offset="1" stopColor="#F5A11A" />
        </linearGradient>
        <linearGradient id={`paint1_linear_${uniqueId}`} x1="6.63337" y1="22.84" x2="6.63337" y2="9.77508" gradientUnits="userSpaceOnUse">
          <stop stopColor="#BF161C" />
          <stop offset="1" stopColor="#E81C24" />
        </linearGradient>
        <linearGradient id={`paint2_linear_${uniqueId}`} x1="15.0856" y1="22.1907" x2="15.0856" y2="16.3259" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8C278A" />
          <stop offset="1" stopColor="#A567A5" />
        </linearGradient>
        <linearGradient id={`paint3_linear_${uniqueId}`} x1="13.6735" y1="10.598" x2="13.6735" y2="1.92347" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F28E1E" />
          <stop offset="1" stopColor="#FFC605" />
        </linearGradient>
        <linearGradient id={`paint4_linear_${uniqueId}`} x1="18.8642" y1="16.1243" x2="18.8642" y2="3.36255" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00A9EA" />
          <stop offset="1" stopColor="#6DCAF1" />
        </linearGradient>
      </defs>
    </svg>
  );
}; 