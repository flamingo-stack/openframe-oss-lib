import type { SVGProps } from "react";
export interface ChatVoicemailIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ChatVoicemailIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ChatVoicemailIconProps) {
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
        d="M8.876 12a.876.876 0 1 0-1.752.002A.876.876 0 0 0 8.876 12m8 0a.875.875 0 1 0-1.751 0 .875.875 0 0 0 1.75 0Zm2.25 0c0 1.617-1.23 2.95-2.806 3.11l-.32.016H8a3.126 3.126 0 1 1 3.126-3.127c0 .305-.047.598-.128.877h2.004A3.126 3.126 0 1 1 19.125 12Z"
      />
    </svg>
  );
}
