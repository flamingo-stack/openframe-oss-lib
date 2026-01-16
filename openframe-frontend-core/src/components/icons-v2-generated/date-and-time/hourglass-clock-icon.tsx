import type { SVGProps } from "react";
export interface HourglassClockIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function HourglassClockIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: HourglassClockIconProps) {
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
        d="M1.875 22v-3.343c0-1.36.54-2.663 1.501-3.624l2.415-2.414.11-.138a.88.88 0 0 0 0-.962l-.11-.138-2.415-2.414a5.13 5.13 0 0 1-1.501-3.624V2a1.125 1.125 0 0 1 2.25 0v3.343c0 .762.303 1.494.842 2.033L7.381 9.79a3.125 3.125 0 0 1 0 4.42l-2.414 2.413a2.88 2.88 0 0 0-.842 2.034V22a1.125 1.125 0 0 1-2.25 0m12-16.657V2a1.125 1.125 0 0 1 2.25 0v3.343c0 1.359-.54 2.663-1.502 3.624l-.7.7a1.125 1.125 0 0 1-1.59-1.59l.7-.701c.539-.54.842-1.27.842-2.033"
      />
      <path
        fill={color}
        d="m9.512 20.875.115.005a1.126 1.126 0 0 1 0 2.239l-.115.006H2a1.125 1.125 0 0 1 0-2.25zM20.875 17a3.874 3.874 0 1 0-7.749 0 3.874 3.874 0 0 0 7.749 0m-5-2a1.125 1.125 0 0 1 2.25 0v1.121l1.148.287a1.126 1.126 0 0 1-.546 2.183l-2-.5A1.125 1.125 0 0 1 15.875 17zM15.999.876l.116.006a1.125 1.125 0 0 1 0 2.238L16 3.125H2a1.125 1.125 0 0 1 0-2.25h14ZM23.125 17a6.124 6.124 0 1 1-12.249 0 6.124 6.124 0 0 1 12.249 0"
      />
    </svg>
  );
}
