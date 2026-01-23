import type { SVGProps } from "react";
export interface WifiIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function WifiIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: WifiIconProps) {
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
        d="M12.217 16.886a2.125 2.125 0 1 1-2.332 2.332L9.875 19l.01-.217a2.126 2.126 0 0 1 2.116-1.908zm-5.321-2.203c2.81-2.982 7.397-2.982 10.208 0a1.126 1.126 0 0 1-1.636 1.544c-1.923-2.04-5.012-2.04-6.935 0a1.126 1.126 0 0 1-1.637-1.544M4.458 11.23c4.271-4.092 10.813-4.092 15.084 0l.42.422.075.088a1.126 1.126 0 0 1-1.63 1.535l-.083-.08-.334-.336c-3.517-3.373-8.923-3.26-12.315.337l-.082.079a1.125 1.125 0 0 1-1.554-1.623l.42-.422ZM1.181 8.621c5.967-6.328 15.67-6.328 21.638 0a1.126 1.126 0 0 1-1.637 1.544c-5.078-5.387-13.284-5.387-18.363 0a1.126 1.126 0 0 1-1.638-1.544"
      />
    </svg>
  );
}
