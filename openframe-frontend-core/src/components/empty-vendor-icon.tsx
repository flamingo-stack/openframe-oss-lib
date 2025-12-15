import React from 'react';

interface EmptyVendorIconProps {
  className?: string;
}

export function EmptyVendorIcon({ className }: EmptyVendorIconProps) {
  return (
    <svg 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      xmlnsXlink="http://www.w3.org/1999/xlink"
      className={className}
    >
      <path 
        d="M0 4C0 1.79086 1.79086 0 4 0H20C22.2091 0 24 1.79086 24 4V20C24 22.2091 22.2091 24 20 24H4C1.79086 24 0 22.2091 0 20V4Z" 
        fill="url(#pattern0_1643_33816)"
      />
      <defs>
        <pattern 
          id="pattern0_1643_33816" 
          patternContentUnits="objectBoundingBox" 
          width="1" 
          height="1"
        >
          <use 
            xlinkHref="#image0_1643_33816" 
            transform="scale(0.0104167)"
          />
        </pattern>
        <image 
          id="image0_1643_33816" 
          width="96" 
          height="96" 
          preserveAspectRatio="none" 
          xlinkHref="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAAACXBIWXMAABYlAAAWJQFJUiTwAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAANKSURBVHgB7Z2JbiIxEETNfSPB/38j4hI37G5FQjuJGBjwUe5JPWkUKaCI+Hna7XZP0vjzDydoNJ2gIgFkJICMBJCRADISQEYCyEgAGQkgIwFkJICMBJCRADISQEYCyLSdJ+fz2S0WC2f5WKHRaLjRaOTG47FLjfcdsFwuTQ8+wOffbreU38NbwPV6dXUBd3NqtAaQkQAyEkDGOwsqYzAYULKKVxwOB7fZbFwuRBPQarW+rtxoNvO66RWCyEgAGQkgIwFkoi3Cr8AOmrGLvlwuH732k1BJBkXAer12u93O5QY+1ztMp1M3HA6dD8lDEOotOQ7+J6CA50tyAXXqhr/dbs4XLcJkJICMBJChpaGPmEwmrtPpuNxAAS9W4pCVAAx+t9t1uRFzv6IQREYCyEgAGQkgk9UiXAUUzFDOwMlWu93O8tTtHcwIQAkDTWDH4/Hb93HunOPZc1XMhCBUKn8OPkBBzHJxz4QA5OH7/b709RBVSRYmBJxOp6evoypptUWyNllQbu0mVTHxqXu93lcLeRkoYTx7PWeiZUGI2Y9CxycHMpjdyHTKOtpwNGiVaAJCH7rjAQqIwIJ7/7ko3EFMjhXUqpjaiKHfFBcEQIbVsFPE3E4YWN/9FvFehOswC5l4C0BIEJ/jHYKQgWAxrJrd1KkvKARB1oB+v1/5vYjfEvAfnQeQkQAyEkBGAshIABkJIJNVKQKFtnfKDKgHoZ3RMlkJeHXy9YgUAkI8B1CGyWJcCrCzx4YRO/dHzQChkIACuAOLVwqSC8ipeopZjtZzDDa+Mh6fSi4AiywksJ4VQ2cdQgquVLP8GckFIHOZzWZv9fL4HG9C9D2OI6aHFB+iI4+yBqB8PZ/PK78fB/yr1ary+yELIQWDjsEPOejoR0WXBq4QD5PUZhFGOMGAY+BDNgMgXOLQHwOOh7JDr2HmBeBPZoae5VincMaBQY/dc2ReQKiFFOEEA46BT3no/2v3AZjVCCn38MJKj3+VAMzy4pUDtRaAWY2QgsHG1xxbaGonIHSaGBvzAmKnibEx25qYKk2MjQkBGGBWmhibhv6fMBedCZORADISQEYCyEgAGQkgIwFkJICMBJCRADISQEYCyEgAGQkgIwFk/gLUSDIjX8qP4wAAAABJRU5ErkJggg=="
        />
      </defs>
    </svg>
  );
} 