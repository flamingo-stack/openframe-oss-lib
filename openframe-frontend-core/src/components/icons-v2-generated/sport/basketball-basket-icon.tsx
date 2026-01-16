import type { SVGProps } from "react";
export interface BasketballBasketIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function BasketballBasketIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: BasketballBasketIconProps) {
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
        d="M20.875 16V6c0-1.036-.84-1.875-1.875-1.875H5c-1.036 0-1.875.84-1.875 1.875v10c0 .937.688 1.713 1.585 1.852l.182.02.114.012a1.125 1.125 0 0 1-.126 2.236l-.116-.002-.4-.042A4.125 4.125 0 0 1 .875 16V6A4.125 4.125 0 0 1 5 1.875h14A4.125 4.125 0 0 1 23.125 6v10a4.125 4.125 0 0 1-3.885 4.118 1.126 1.126 0 0 1-.13-2.247 1.874 1.874 0 0 0 1.765-1.87Z"
      />
      <path
        fill={color}
        d="M13.875 22v-.375h-.75V22a1.125 1.125 0 0 1-2.25 0v-.375h-.75V22a1.125 1.125 0 0 1-2.25 0c0-3.122-.07-4.49-1.55-5.6a1.13 1.13 0 0 1-.45-.9v-1.382A1.125 1.125 0 0 1 6 11.876h12a1.125 1.125 0 0 1 .125 2.242V15.5c0 .355-.167.689-.45.901-1.48 1.11-1.55 2.478-1.55 5.6a1.125 1.125 0 0 1-2.25 0Zm-.75-2.625h.812q.051-.642.178-1.25h-.99zm-3.24-1.25q.127.608.178 1.25h.812v-1.25zm3.24-2.25h1.938q.336-.475.811-.906v-.843h-2.749v1.748Zm-5-.906c.32.287.587.59.812.905h1.938v-1.748h-2.75zm10-5.47a1.125 1.125 0 0 1-2.25 0v-.874h-7.75V9.5a1.125 1.125 0 0 1-2.25 0v-1c0-1.173.951-2.125 2.125-2.125h8c1.174 0 2.125.952 2.125 2.125z"
      />
    </svg>
  );
}
