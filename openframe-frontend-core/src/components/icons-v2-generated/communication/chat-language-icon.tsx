import type { SVGProps } from "react";
export interface ChatLanguageIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ChatLanguageIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ChatLanguageIconProps) {
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
        d="M4.133 4.133c4.344-4.345 11.39-4.345 15.734 0s4.344 11.39 0 15.734c-3.477 3.477-8.68 4.17-12.847 2.084l-3.17.762c-1.543.37-2.933-1.02-2.563-2.562l.76-3.173C-.037 12.812.657 7.609 4.133 4.133m14.143 1.592a8.875 8.875 0 0 0-12.55 0 8.88 8.88 0 0 0-1.5 10.562c.136.245.175.534.109.807l-.813 3.382 3.385-.811.207-.03c.207-.01.415.038.599.14a8.875 8.875 0 0 0 10.563-14.05"
      />
      <path
        fill={color}
        d="M9.503 17.506a1.125 1.125 0 0 1-1.006-2.012zM10.876 7.5a1.125 1.125 0 0 1 2.25 0v.287H16l.115.006a1.125 1.125 0 0 1 0 2.238l-.115.006h-.47a11.6 11.6 0 0 1-1.779 3.763q.213.128.4.223a1.126 1.126 0 0 1-1.006 2.013 9 9 0 0 1-.873-.512c-.84.81-1.778 1.487-2.769 1.982L9.001 16.5l-.504-1.006a9 9 0 0 0 1.982-1.374 11 11 0 0 1-1.323-1.462l-.21-.3-.058-.097a1.126 1.126 0 0 1 1.862-1.242l.068.092.162.228c.278.377.621.747.987 1.092a9.5 9.5 0 0 0 1.217-2.394H8a1.125 1.125 0 0 1 0-2.25h2.876z"
      />
    </svg>
  );
}
