import type { SVGProps } from "react";
export interface DiamondGemIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function DiamondGemIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: DiamondGemIconProps) {
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
        d="M13.077 21.324a1.125 1.125 0 1 1-2.155-.648zm-.35-19.415a1.126 1.126 0 0 1 1.365.818l1.787 7.147h6.097l.114.006a1.126 1.126 0 0 1 0 2.239l-.114.005h-6.14l-2.76 9.2-2.154-.648 2.567-8.552H2.025a1.125 1.125 0 0 1 0-2.25h11.534l-1.651-6.602a1.126 1.126 0 0 1 .819-1.363"
      />
      <path
        fill={color}
        d="M16.826 1.875a3.13 3.13 0 0 1 2.73 1.601l3.174 5.68.115.23a3.13 3.13 0 0 1-.593 3.462l-8 8.315a3.126 3.126 0 0 1-4.504 0l-8-8.315a3.13 3.13 0 0 1-.477-3.691l3.174-5.681.11-.182a3.13 3.13 0 0 1 2.618-1.42h9.653Zm-9.653 2.25a.88.88 0 0 0-.699.35l-.064.098-3.175 5.68a.88.88 0 0 0 .134 1.035l8 8.314a.875.875 0 0 0 1.262 0l8-8.314a.88.88 0 0 0 .193-.904l-.059-.13-3.174-5.68a.88.88 0 0 0-.765-.45H7.173Z"
      />
    </svg>
  );
}
