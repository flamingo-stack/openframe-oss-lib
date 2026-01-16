import type { SVGProps } from "react";
export interface ClipboardExclamationIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ClipboardExclamationIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: ClipboardExclamationIconProps) {
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
        d="M2.875 19V6A4.125 4.125 0 0 1 7 1.875h1.25l.115.006a1.125 1.125 0 0 1 0 2.238l-.115.006H7c-1.036 0-1.875.84-1.875 1.875v13c0 1.036.84 1.875 1.875 1.875h10c1.036 0 1.875-.84 1.875-1.875V6c0-1.035-.84-1.875-1.875-1.875h-1.25a1.125 1.125 0 0 1 0-2.25H17A4.125 4.125 0 0 1 21.125 6v13A4.126 4.126 0 0 1 17 23.125H7A4.125 4.125 0 0 1 2.875 19"
      />
      <path
        fill={color}
        d="M10.876 14v-4a1.125 1.125 0 0 1 2.25 0v4a1.125 1.125 0 0 1-2.25 0m2.498 4a1.374 1.374 0 0 1-2.742.141l-.007-.14.007-.141a1.375 1.375 0 0 1 1.369-1.235l.14.007A1.375 1.375 0 0 1 13.374 18m1.5-14A.875.875 0 0 0 14 3.125h-4A.875.875 0 0 0 9.125 4v.375h5.75zm2.25 1c0 .897-.726 1.625-1.624 1.625h-7A1.625 1.625 0 0 1 6.875 5V4A3.125 3.125 0 0 1 10 .875h4A3.125 3.125 0 0 1 17.125 4v1Z"
      />
    </svg>
  );
}
