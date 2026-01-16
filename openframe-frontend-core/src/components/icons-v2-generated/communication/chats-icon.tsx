import type { SVGProps } from "react";
export interface ChatsIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ChatsIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: ChatsIconProps) {
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
        d="M3.888 3.225a9.125 9.125 0 0 1 12.564.323l.366.387.34.404.066.094a1.125 1.125 0 0 1-1.753 1.39l-.076-.086-.257-.305-.277-.293a6.875 6.875 0 0 0-9.465-.245l-.257.245a6.88 6.88 0 0 0-1.161 8.181c.135.246.175.534.11.807l-.566 2.35 1.367-.328a1.126 1.126 0 0 1 .524 2.188l-1.563.375c-1.543.37-2.934-1.019-2.563-2.562l.515-2.143A9.125 9.125 0 0 1 3.548 3.548z"
      />
      <path
        fill={color}
        d="M10.109 10.109a7.624 7.624 0 0 1 12.274 8.67l.52 2.165a1.624 1.624 0 0 1-1.959 1.959l-2.165-.52a7.625 7.625 0 0 1-8.67-12.274m9.192 1.59a5.375 5.375 0 1 0-7.601 7.602 5.38 5.38 0 0 0 6.397.908l.19-.084a1.13 1.13 0 0 1 .616-.026l1.574.378-.378-1.575a1.13 1.13 0 0 1 .11-.805 5.38 5.38 0 0 0-.908-6.397Z"
      />
    </svg>
  );
}
