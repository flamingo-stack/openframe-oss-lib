import type { SVGProps } from "react";
export interface AlphabetMCircleIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AlphabetMCircleIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: AlphabetMCircleIconProps) {
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
        d="M20.875 12a8.875 8.875 0 1 0-17.75 0 8.875 8.875 0 0 0 17.75 0m2.25 0c0 6.144-4.98 11.124-11.124 11.125S.875 18.145.875 12 5.856.875 12.001.875c6.143 0 11.124 4.981 11.124 11.126Z"
      />
      <path
        fill={color}
        d="M14.376 16v-4.565l-1.12 2.51c-.454 1.02-1.84 1.083-2.41.191l-.102-.19-1.119-2.51V16a1.125 1.125 0 0 1-2.25 0V8.5c0-1.7 2.249-2.232 3.038-.806l.072.143 1.514 3.4 1.517-3.4.071-.143c.79-1.425 3.038-.894 3.038.806V16a1.125 1.125 0 0 1-2.25 0Z"
      />
    </svg>
  );
}
