import type { SVGProps } from "react";
export interface SlackIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function SlackIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: SlackIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      {...props}
    >
      <path
        fill="#E01E5A"
        d="M5.042 15.165a2.53 2.53 0 0 1-2.52 2.523A2.53 2.53 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.53 2.53 0 0 1 8.834 24a2.53 2.53 0 0 1-2.521-2.522z"
      />
      <path
        fill="#36C5F0"
        d="M8.834 5.042a2.53 2.53 0 0 1-2.521-2.52A2.53 2.53 0 0 1 8.834 0a2.53 2.53 0 0 1 2.521 2.522v2.52zm0 1.271a2.53 2.53 0 0 1 2.521 2.521 2.53 2.53 0 0 1-2.521 2.521H2.522A2.53 2.53 0 0 1 0 8.834a2.53 2.53 0 0 1 2.522-2.521z"
      />
      <path
        fill="#2EB67D"
        d="M18.956 8.834a2.53 2.53 0 0 1 2.521-2.521A2.53 2.53 0 0 1 24 8.834a2.53 2.53 0 0 1-2.523 2.521h-2.521zm-1.268 0a2.53 2.53 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.53 2.53 0 0 1 2.523 2.522z"
      />
      <path
        fill="#ECB22E"
        d="M15.165 18.956a2.53 2.53 0 0 1 2.523 2.521A2.53 2.53 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.523v-2.521zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.53 2.53 0 0 1 2.52-2.521h6.313A2.53 2.53 0 0 1 24 15.165a2.53 2.53 0 0 1-2.522 2.523z"
      />
    </svg>
  );
}
