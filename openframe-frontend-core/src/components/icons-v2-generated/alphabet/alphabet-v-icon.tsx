import type { SVGProps } from "react";
export interface AlphabetVIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AlphabetVIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: AlphabetVIconProps) {
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
        d="M15.906 3.74a1.125 1.125 0 1 1 2.189.52l-3.542 14.848c-.621 2.605-4.228 2.686-5.036.245l-.07-.245L5.905 4.261l-.02-.113a1.125 1.125 0 0 1 2.176-.52l.032.111 3.54 14.848a.35.35 0 0 0 .131.217.4.4 0 0 0 .234.072c.098 0 .18-.032.236-.072a.35.35 0 0 0 .13-.217l3.541-14.848Z"
      />
    </svg>
  );
}
