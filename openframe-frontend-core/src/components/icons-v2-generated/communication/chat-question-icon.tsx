import type { SVGProps } from "react";
export interface ChatQuestionIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ChatQuestionIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ChatQuestionIconProps) {
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
        d="M12.876 10.01V10A.883.883 0 0 0 12 9.125c-.448 0-.835.311-.93.606a1.125 1.125 0 0 1-2.14-.697c.426-1.307 1.74-2.159 3.07-2.159A3.133 3.133 0 0 1 15.126 10v.01c0 1.398-.863 2.191-1.493 2.62a10 10 0 0 1-.529.327 1.125 1.125 0 0 1-2.23-.207v-.3c0-.497.28-.824.421-.964.149-.147.317-.256.423-.322.304-.189.404-.225.65-.393.37-.251.508-.454.508-.761m.5 5.99a1.376 1.376 0 0 1-2.743.14l-.007-.14.007-.141A1.374 1.374 0 0 1 12 14.626l.14.007c.694.07 1.235.655 1.235 1.367Z"
      />
    </svg>
  );
}
