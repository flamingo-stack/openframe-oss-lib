import type { SVGProps } from "react";
export interface StickerDotsIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function StickerDotsIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: StickerDotsIconProps) {
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
        d="M10.875 20.75V17A4.125 4.125 0 0 1 15 12.873h5.75a1.125 1.125 0 0 1 0 2.25H15c-1.035 0-1.875.84-1.875 1.876v3.75a1.125 1.125 0 0 1-2.25 0ZM8.375 17a1.375 1.375 0 0 1-2.743.14L5.625 17l.007-.141A1.375 1.375 0 0 1 7 15.625l.141.008c.693.07 1.233.655 1.234 1.367m0-5a1.375 1.375 0 0 1-2.743.14L5.625 12l.007-.14A1.376 1.376 0 0 1 7 10.623l.141.008c.693.07 1.234.656 1.234 1.368Zm0-5a1.374 1.374 0 0 1-2.743.141l-.007-.14.007-.141A1.375 1.375 0 0 1 7 5.625l.141.007A1.376 1.376 0 0 1 8.375 7"
      />
      <path
        fill={color}
        d="M19.875 6c0-1.036-.84-1.875-1.875-1.875H6c-1.036 0-1.875.84-1.875 1.875v12c0 1.035.84 1.875 1.875 1.875h5.613l8.262-6.426zm2.25 7.51c0 .574-.232 1.12-.637 1.518l-.183.161-8.344 6.488c-.373.29-.831.448-1.304.448H6A4.125 4.125 0 0 1 1.875 18V6A4.125 4.125 0 0 1 6 1.875h12A4.125 4.125 0 0 1 22.125 6z"
      />
    </svg>
  );
}
