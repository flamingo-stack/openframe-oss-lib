import type { SVGProps } from "react";
export interface AngleIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AngleIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: AngleIconProps) {
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
        d="M18.166 14.18q.42.916.726 1.877l.192.643.025.113a1.125 1.125 0 0 1-2.158.596l-.036-.11-.166-.557a15 15 0 0 0-.63-1.627zm-1.49-.556a1.125 1.125 0 0 1 1.49.556l-2.047.935a1.126 1.126 0 0 1 .557-1.491m-4.611-5.23a1.125 1.125 0 0 1 1.492-.21l.093.07.558.487a17 17 0 0 1 1.535 1.604 1.125 1.125 0 1 1-1.723 1.446 15 15 0 0 0-1.331-1.389l-.484-.423-.085-.08a1.125 1.125 0 0 1-.055-1.505"
      />
      <path
        fill={color}
        d="M9.991 2.5a1.125 1.125 0 0 1 2.017 1L4.167 19.333a.375.375 0 0 0 .335.542H21l.116.006a1.125 1.125 0 0 1 0 2.238l-.116.006H4.502c-1.946 0-3.216-2.045-2.352-3.79z"
      />
    </svg>
  );
}
