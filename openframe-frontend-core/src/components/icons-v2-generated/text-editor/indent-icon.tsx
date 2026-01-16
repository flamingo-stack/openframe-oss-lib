import type { SVGProps } from "react";
export interface IndentIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function IndentIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: IndentIconProps) {
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
        d="M21 18.375a1.125 1.125 0 0 1 0 2.25H3a1.125 1.125 0 0 1 0-2.25zm0-5 .116.006a1.125 1.125 0 0 1 0 2.239l-.116.006H10a1.125 1.125 0 0 1 0-2.25h11Zm0-5 .116.005a1.126 1.126 0 0 1 0 2.239l-.116.005H10a1.125 1.125 0 0 1 0-2.25zm0-5a1.125 1.125 0 0 1 0 2.25H3a1.125 1.125 0 0 1 0-2.25zM2.512 7.786c.39-.187.853-.135 1.191.135l4 3.2a1.127 1.127 0 0 1 0 1.757l-4 3.2a1.126 1.126 0 0 1-1.828-.878V8.8l.012-.16c.052-.367.284-.69.625-.854m1.613 5.072 1.074-.859-1.074-.858z"
      />
    </svg>
  );
}
