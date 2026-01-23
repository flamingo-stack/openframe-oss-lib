import type { SVGProps } from "react";
export interface EraserIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function EraserIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: EraserIconProps) {
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
        d="M9.205 6.205a1.125 1.125 0 0 1 1.505-.078l.085.078 7.75 7.75.077.085a1.125 1.125 0 0 1-1.582 1.582l-.085-.076-7.75-7.75-.078-.086a1.125 1.125 0 0 1 .078-1.505"
      />
      <path
        fill={color}
        d="M12.397 2.8a4.127 4.127 0 0 1 5.521.285l3.758 3.757a4.125 4.125 0 0 1 0 5.833l-7.2 7.2H22l.114.006a1.126 1.126 0 0 1 0 2.238l-.114.006H6.589a3.13 3.13 0 0 1-1.98-.707l-.23-.209-2.293-2.292a4.126 4.126 0 0 1 0-5.834l9.998-9.998.313-.284Zm3.93 1.876a1.876 1.876 0 0 0-2.509-.13l-.142.13-10 9.999a1.875 1.875 0 0 0 0 2.651L5.97 19.62a.88.88 0 0 0 .62.256h4.705l8.79-8.79a1.875 1.875 0 0 0 0-2.652l-3.757-3.757Z"
      />
    </svg>
  );
}
