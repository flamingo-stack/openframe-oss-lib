import type { SVGProps } from "react";
export interface HeadingH4IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function HeadingH4Icon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: HeadingH4IconProps) {
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
        d="M19.375 20v-.626H16.75a1.374 1.374 0 0 1-1.174-2.089l3.5-5.75.149-.203c.796-.916 2.4-.384 2.4.918v4.874H22l.116.006a1.126 1.126 0 0 1 0 2.24l-.116.004h-.375V20a1.125 1.125 0 0 1-2.25 0m-1.067-2.876h1.067v-1.753zM11.874 20v-6.876H3.125V20a1.125 1.125 0 0 1-2.25 0V4a1.125 1.125 0 0 1 2.25 0v6.874h8.75V4a1.125 1.125 0 0 1 2.25 0v16a1.125 1.125 0 0 1-2.25 0Z"
      />
    </svg>
  );
}
