import type { SVGProps } from "react";
export interface Parcel02FastIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Parcel02FastIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Parcel02FastIconProps) {
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
        d="m20.875 8.412-6.75 3.749v7.36l5.774-3.155.214-.136c.475-.35.762-.909.762-1.509zm-18 2.589V8.279c0-.704.182-1.381.508-1.978a1.1 1.1 0 0 1 .17-.285 4.1 4.1 0 0 1 1.468-1.357l6-3.28.234-.118a4.13 4.13 0 0 1 3.724.119l6 3.28.242.143c.499.319.914.738 1.23 1.222a1.1 1.1 0 0 1 .165.276c.327.597.509 1.274.509 1.978v6.442a4.13 4.13 0 0 1-2.146 3.62l-6 3.28a4.13 4.13 0 0 1-3.724.119l-.234-.12-.91-.497-.098-.06a1.125 1.125 0 0 1 1.074-1.965l.104.05.684.374V12.16l-6.75-3.749V11a1.125 1.125 0 0 1-2.25 0Zm3.454-4.493 6.67 3.705L15.183 9 8.53 5.305zm7.57-3.154a1.88 1.88 0 0 0-1.583-.1l-.216.1-1.237.676 6.635 3.684 2.171-1.206z"
      />
      <path
        fill={color}
        d="m7 20.876.115.006a1.125 1.125 0 0 1 0 2.238L7 23.126H4a1.126 1.126 0 0 1 0-2.25zm0-3.501.115.006a1.125 1.125 0 0 1 0 2.238L7 19.625H2a1.125 1.125 0 1 1 0-2.25zm0-3.5.115.006a1.125 1.125 0 0 1 0 2.238L7 16.125H3a1.125 1.125 0 1 1 0-2.25z"
      />
    </svg>
  );
}
