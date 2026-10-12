import { useId, type SVGProps } from "react";
export interface EmptyVendorIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function EmptyVendorIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: EmptyVendorIconProps) {
  // Per-instance ids: see scopeIds in scripts/generate-icons.mjs.
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      fill="none"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      {...props}
    >
      <path
        fill={`url(#${uid}empty-vendor_svg__a)`}
        d="M0 4a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4v16a4 4 0 0 1-4 4H4a4 4 0 0 1-4-4z"
      />
      <defs>
        <pattern
          id={`${uid}empty-vendor_svg__a`}
          width={1}
          height={1}
          patternContentUnits="objectBoundingBox"
        >
          <use xlinkHref={`#${uid}empty-vendor_svg__b`} transform="scale(.01042)" />
        </pattern>
        <image
          xlinkHref="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAAACXBIWXMAABYlAAAWJQFJUiTwAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAANKSURBVHgB7Z2JbiIxEETNfSPB/38j4hI37G5FQjuJGBjwUe5JPWkUKaCI+Hna7XZP0vjzDydoNJ2gIgFkJICMBJCRADISQEYCyEgAGQkgIwFkJICMBJCRADISQEYCyLSdJ+fz2S0WC2f5WKHRaLjRaOTG47FLjfcdsFwuTQ8+wOffbreU38NbwPV6dXUBd3NqtAaQkQAyEkDGOwsqYzAYULKKVxwOB7fZbFwuRBPQarW+rtxoNvO66RWCyEgAGQkgIwFkoi3Cr8AOmrGLvlwuH732k1BJBkXAer12u93O5QY+1ztMp1M3HA6dD8lDEOotOQ7+J6CA50tyAXXqhr/dbs4XLcJkJICMBJChpaGPmEwmrtPpuNxAAS9W4pCVAAx+t9t1uRFzv6IQREYCyEgAGQkgk9UiXAUUzFDOwMlWu93O8tTtHcwIQAkDTWDH4/Hb93HunOPZc1XMhCBUKn8OPkBBzHJxz4QA5OH7/b709RBVSRYmBJxOp6evoypptUWyNllQbu0mVTHxqXu93lcLeRkoYTx7PWeiZUGI2Y9CxycHMpjdyHTKOtpwNGiVaAJCH7rjAQqIwIJ7/7ko3EFMjhXUqpjaiKHfFBcEQIbVsFPE3E4YWN/9FvFehOswC5l4C0BIEJ/jHYKQgWAxrJrd1KkvKARB1oB+v1/5vYjfEvAfnQeQkQAyEkBGAshIABkJIJNVKQKFtnfKDKgHoZ3RMlkJeHXy9YgUAkI8B1CGyWJcCrCzx4YRO/dHzQChkIACuAOLVwqSC8ipeopZjtZzDDa+Mh6fSi4AiywksJ4VQ2cdQgquVLP8GckFIHOZzWZv9fL4HG9C9D2OI6aHFB+iI4+yBqB8PZ/PK78fB/yr1ary+yELIQWDjsEPOejoR0WXBq4QD5PUZhFGOMGAY+BDNgMgXOLQHwOOh7JDr2HmBeBPZoae5VincMaBQY/dc2ReQKiFFOEEA46BT3no/2v3AZjVCCn38MJKj3+VAMzy4pUDtRaAWY2QgsHG1xxbaGonIHSaGBvzAmKnibEx25qYKk2MjQkBGGBWmhibhv6fMBedCZORADISQEYCyEgAGQkgIwFkJICMBJCRADISQEYCyEgAGQkgIwFk/gLUSDIjX8qP4wAAAABJRU5ErkJggg=="
          id={`${uid}empty-vendor_svg__b`}
          width={96}
          height={96}
          preserveAspectRatio="none"
        />
      </defs>
    </svg>
  );
}
