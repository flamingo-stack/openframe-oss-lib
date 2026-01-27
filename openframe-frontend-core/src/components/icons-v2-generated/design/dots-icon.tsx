import type { SVGProps } from "react";
export interface DotsIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function DotsIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: DotsIconProps) {
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
        d="M5.217 16.885a2.126 2.126 0 1 1-2.332 2.332l-.01-.216.01-.219A2.126 2.126 0 0 1 5 16.875zm7 0a2.126 2.126 0 0 1-.218 4.24c-1.1 0-2.004-.836-2.113-1.908l-.01-.216.01-.219A2.125 2.125 0 0 1 12 16.875zm6.783-.01a2.126 2.126 0 1 1-2.114 2.342l-.011-.216.011-.219A2.125 2.125 0 0 1 19 16.875M5.217 9.886a2.125 2.125 0 1 1-2.332 2.332l-.01-.219.01-.216A2.126 2.126 0 0 1 5 9.875zm7 0a2.125 2.125 0 1 1-2.331 2.332l-.01-.219.01-.216A2.125 2.125 0 0 1 12 9.875zm7 0a2.126 2.126 0 1 1-2.33 2.332l-.012-.219.011-.216A2.125 2.125 0 0 1 19 9.875zm-14-7a2.126 2.126 0 1 1-2.332 2.331L2.875 5l.01-.218A2.126 2.126 0 0 1 5 2.875l.217.01Zm7 0A2.126 2.126 0 0 1 12 7.124c-1.1 0-2.004-.836-2.113-1.908L9.876 5l.01-.218A2.125 2.125 0 0 1 12 2.875l.218.01ZM19 2.874a2.126 2.126 0 1 1-2.114 2.342L16.875 5l.011-.218A2.125 2.125 0 0 1 19 2.875Z"
      />
    </svg>
  );
}
