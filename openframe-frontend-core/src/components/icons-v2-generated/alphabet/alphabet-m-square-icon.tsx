import type { SVGProps } from "react";
export interface AlphabetMSquareIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AlphabetMSquareIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: AlphabetMSquareIconProps) {
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
        d="M19.875 6c0-1.036-.84-1.875-1.875-1.875H6c-1.036 0-1.875.84-1.875 1.875v12c0 1.035.84 1.875 1.875 1.875h12c1.035 0 1.875-.84 1.875-1.875zm2.25 12A4.125 4.125 0 0 1 18 22.125H6A4.125 4.125 0 0 1 1.875 18V6A4.125 4.125 0 0 1 6 1.875h12A4.125 4.125 0 0 1 22.125 6z"
      />
      <path
        fill={color}
        d="M14.376 16v-4.565l-1.12 2.51c-.454 1.02-1.84 1.083-2.41.191l-.102-.19-1.119-2.51V16a1.125 1.125 0 0 1-2.25 0V8.5c0-1.7 2.249-2.232 3.038-.806l.072.143 1.514 3.4 1.517-3.4.071-.143c.79-1.425 3.038-.894 3.038.806V16a1.125 1.125 0 0 1-2.25 0Z"
      />
    </svg>
  );
}
