import type { SVGProps } from "react";
export interface BankIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function BankIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: BankIconProps) {
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
        d="M3.375 9a1.125 1.125 0 0 1 2.25 0v7.375h1.75V9a1.125 1.125 0 0 1 2.25 0v7.375h4.75V9a1.125 1.125 0 0 1 2.25 0v7.375h1.75V9a1.125 1.125 0 0 1 2.25 0v7.76c1.185.596 2 1.822 2 3.24v1c0 .621-.503 1.125-1.125 1.125h-19A1.125 1.125 0 0 1 1.375 21v-1c0-1.417.815-2.642 2-3.238zM5 18.625c-.718 0-1.307.55-1.37 1.25h16.74a1.375 1.375 0 0 0-1.37-1.25z"
      />
      <path
        fill={color}
        d="M20.875 7.503a.88.88 0 0 0-.516-.798l-7.59-3.415a1.88 1.88 0 0 0-1.539 0L3.64 6.705a.88.88 0 0 0-.515.798v.372h17.75zM23.125 9c0 .621-.504 1.125-1.125 1.125H2A1.125 1.125 0 0 1 .875 9V7.503c0-1.23.721-2.344 1.843-2.849l7.59-3.416.203-.085a4.13 4.13 0 0 1 3.181.085l7.59 3.416.206.101a3.13 3.13 0 0 1 1.637 2.748z"
      />
    </svg>
  );
}
