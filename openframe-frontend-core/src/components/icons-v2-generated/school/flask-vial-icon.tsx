import type { SVGProps } from "react";
export interface FlaskVialIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function FlaskVialIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: FlaskVialIconProps) {
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
        d="M19.874 12.625h-1.749V20a.875.875 0 0 0 1.75 0v-7.375ZM13 12.375l.116.005a1.125 1.125 0 0 1 0 2.239l-.116.005H3.729a1.125 1.125 0 0 1 0-2.25h9.27Zm5.125-2h1.75v-2.25h-1.75zm4 9.625a3.124 3.124 0 1 1-6.25 0V8.118A1.125 1.125 0 0 1 16 5.875h6a1.125 1.125 0 0 1 .124 2.243V20Z"
      />
      <path
        fill={color}
        d="M10.874 8.787V3.125h-2.75v5.662c0 .63-.19 1.244-.544 1.762l-.161.215L3.44 15.63c-.734.898-.095 2.246 1.065 2.246H13l.116.005a1.125 1.125 0 0 1 0 2.239l-.116.006H4.505c-3.057 0-4.742-3.553-2.806-5.92L5.677 9.34a.88.88 0 0 0 .198-.553V3.125H5.5a1.125 1.125 0 0 1 0-2.25h8l.115.006a1.125 1.125 0 0 1 0 2.238l-.116.006h-.375v5.662c0 .201.07.397.198.553l.55.671a1.125 1.125 0 0 1-1.742 1.424l-.55-.67a3.13 3.13 0 0 1-.694-1.709l-.012-.27Z"
      />
    </svg>
  );
}
