import type { SVGProps } from "react";
export interface TelegramIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function TelegramIcon({
  className = "",
  size = 24,
  color = "var(--color-text-primary)",
  ...props
}: TelegramIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      {...props}
    >
      <path d="m22 2-7 20-4-9-9-4ZM22 2 11 13" />
    </svg>
  );
}
