import type { SVGProps } from "react";
export interface DjinniLogoIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function DjinniLogoIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: DjinniLogoIconProps) {
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
        d="M16.798 5.755c0 .97-.823 1.756-1.838 1.756s-1.839-.786-1.839-1.756S13.944 4 14.96 4c1.015 0 1.838.786 1.838 1.755M22 16.03c0 .97-.823 1.756-1.839 1.756-1.015 0-1.838-.786-1.838-1.756 0-.969.823-1.755 1.838-1.755S22 15.061 22 16.03m-8.7-6.978h3.14v8.306c0 2.697-1.75 4.238-5.292 3.425 1.614-.857 2.152-2.098 2.152-3.425zM7.74 6.997c0-.856 1.166-1.456 3.139-1.456v12.245H8.278l-.538-.857V6.998ZM5.632 8.795c1.211 0 2.108.856 2.108.856v2.02c-.003-.003-.408-.393-.955-.393-1.063 0-1.646.569-1.646 2.078 0 1.51.448 2.118 1.646 2.118.772 0 .955-.451.955-.451v1.95s-.404.984-2.108.984S2 16.63 2 13.333s2.422-4.538 3.632-4.538"
      />
    </svg>
  );
}
