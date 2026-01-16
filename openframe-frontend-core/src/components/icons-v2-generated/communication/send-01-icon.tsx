import type { SVGProps } from "react";
export interface Send01IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Send01Icon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Send01IconProps) {
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
        d="M14.704 7.705a1.126 1.126 0 0 1 1.592 1.59l-6.03 6.031a1.126 1.126 0 0 1-1.592-1.592l6.03-6.03Z"
      />
      <path
        fill={color}
        d="M19.915.944c1.877-.435 3.577 1.264 3.142 3.142l-.051.187-5.107 16.647c-.802 2.614-4.34 3.01-5.7.637l-3.554-6.204L2.444 11.8C.07 10.44.466 6.904 3.08 6.1L19.726.994l.19-.05Zm.472 2.201L3.74 8.252c-.732.225-.841 1.216-.177 1.596l6.349 3.638.18.12q.17.132.302.303l.12.179 3.638 6.35a.875.875 0 0 0 1.596-.179l5.107-16.645.017-.107a.377.377 0 0 0-.38-.38z"
      />
    </svg>
  );
}
