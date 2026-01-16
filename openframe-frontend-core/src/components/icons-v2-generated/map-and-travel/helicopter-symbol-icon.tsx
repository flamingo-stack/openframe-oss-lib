import type { SVGProps } from "react";
export interface HelicopterSymbolIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function HelicopterSymbolIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: HelicopterSymbolIconProps) {
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
        d="M1.976 12.898a1.125 1.125 0 0 1 1.298.766l.029.113.072.324a8.89 8.89 0 0 0 6.85 6.597 1.124 1.124 0 0 1-.449 2.205 11.14 11.14 0 0 1-8.588-8.274l-.091-.405-.016-.115a1.124 1.124 0 0 1 .895-1.211m18.75.766a1.125 1.125 0 0 1 2.177.56l-.091.405a11.14 11.14 0 0 1-8.589 8.274l-.114.017a1.125 1.125 0 0 1-.332-2.222l.323-.073a8.89 8.89 0 0 0 6.598-6.848zM9.776 1.097a1.125 1.125 0 0 1 .448 2.206 8.89 8.89 0 0 0-6.921 6.922 1.125 1.125 0 0 1-2.206-.449 11.14 11.14 0 0 1 8.68-8.679Zm4.333-.016.114.016.406.09a11.14 11.14 0 0 1 8.274 8.59 1.125 1.125 0 0 1-2.205.448 8.89 8.89 0 0 0-6.598-6.85l-.323-.072-.113-.03a1.125 1.125 0 0 1 .445-2.192M13.125 16v-3.375h-2.25V16a1.125 1.125 0 0 1-2.25 0V8a1.125 1.125 0 0 1 2.25 0v2.375h2.25V8a1.125 1.125 0 0 1 2.25 0v8a1.125 1.125 0 0 1-2.25 0"
      />
    </svg>
  );
}
