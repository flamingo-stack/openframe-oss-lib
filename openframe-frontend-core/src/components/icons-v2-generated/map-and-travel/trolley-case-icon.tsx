import type { SVGProps } from "react";
export interface TrolleyCaseIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function TrolleyCaseIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: TrolleyCaseIconProps) {
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
        d="M16.375 15.5V7.115a1.123 1.123 0 0 1-1-1.116V5a.876.876 0 0 0-.876-.875h-.998a.876.876 0 0 0-.877.875v1c0 .579-.436 1.054-.998 1.116V15.5a1.125 1.125 0 0 1-2.25 0V6c0-.58.44-1.06 1.004-1.12a3.123 3.123 0 0 1 3.12-3.005h1a3.12 3.12 0 0 1 3.118 3.006A1.125 1.125 0 0 1 18.625 6v9.5a1.125 1.125 0 0 1-2.25 0m-5.25 4.5a2.125 2.125 0 1 1-4.25 0v-1a1.12 1.12 0 0 1 2.124-.506 1.121 1.121 0 0 1 2.125.506zm9 0a2.125 2.125 0 1 1-4.25 0v-1a1.12 1.12 0 0 1 2.124-.506 1.121 1.121 0 0 1 2.126.506z"
      />
      <path
        fill={color}
        d="M2.375 14.5v-10A.375.375 0 0 0 2 4.125a1.125 1.125 0 0 1 0-2.25A2.625 2.625 0 0 1 4.625 4.5v10A3.375 3.375 0 0 0 8 17.876h14l.115.006a1.125 1.125 0 0 1 0 2.239l-.115.005H8a5.625 5.625 0 0 1-5.625-5.624Zm17.5-7a.375.375 0 0 0-.375-.375h-11a.375.375 0 0 0-.375.375V14c0 .207.168.374.375.374h11a.375.375 0 0 0 .375-.375zm2.25 6.5a2.625 2.625 0 0 1-2.625 2.625h-11a2.625 2.625 0 0 1-2.625-2.626V7.5A2.625 2.625 0 0 1 8.5 4.875h11A2.625 2.625 0 0 1 22.125 7.5z"
      />
    </svg>
  );
}
