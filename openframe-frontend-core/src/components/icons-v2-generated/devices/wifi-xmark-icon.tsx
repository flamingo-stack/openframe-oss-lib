import type { SVGProps } from "react";
export interface WifiXmarkIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function WifiXmarkIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: WifiXmarkIconProps) {
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
        d="M6.896 14.682c2.81-2.98 7.397-2.98 10.208 0a1.126 1.126 0 0 1-1.636 1.545c-1.923-2.04-5.012-2.04-6.935 0a1.126 1.126 0 0 1-1.637-1.545m5.676-6.506.615.051.113.018a1.126 1.126 0 0 1-.248 2.225l-.115-.008-.484-.04c-2.426-.13-4.904.787-6.778 2.774l-.082.079a1.125 1.125 0 0 1-1.554-1.623l.476-.478c2.272-2.146 5.183-3.152 8.057-2.998m.513-4.26a1.125 1.125 0 0 1-.169 2.243C9.307 5.889 5.6 7.215 2.82 10.165a1.126 1.126 0 0 1-1.638-1.544c3.25-3.447 7.623-5.025 11.904-4.705Zm-.868 12.97a2.125 2.125 0 1 1-2.332 2.332l-.01-.219.01-.216a2.126 2.126 0 0 1 2.116-1.908zm8.987-12.681a1.125 1.125 0 0 1 1.591 1.59L21.09 7.5l1.705 1.705.078.086a1.124 1.124 0 0 1-1.582 1.583l-.087-.078L19.5 9.09l-1.703 1.705a1.125 1.125 0 1 1-1.591-1.591l1.703-1.705-1.703-1.704-.078-.085a1.126 1.126 0 0 1 1.584-1.583l.085.078L19.5 5.908z"
      />
    </svg>
  );
}
