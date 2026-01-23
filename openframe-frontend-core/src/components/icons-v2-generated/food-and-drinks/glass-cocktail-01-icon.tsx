import type { SVGProps } from "react";
export interface GlassCocktail01IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function GlassCocktail01Icon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: GlassCocktail01IconProps) {
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
        d="m18.096 4.875.116.006a1.125 1.125 0 0 1 0 2.238l-.116.006H5.904a1.125 1.125 0 0 1 0-2.25z"
      />
      <path
        fill={color}
        d="M18.498.875c2.348 0 3.515 2.848 1.842 4.496l-7.214 7.1v8.404H15l.114.005a1.126 1.126 0 0 1 0 2.239l-.114.006H9a1.125 1.125 0 0 1 0-2.25h1.875V12.47L3.66 5.37C1.987 3.723 3.154.875 5.502.875H18.5ZM5.502 3.125a.375.375 0 0 0-.263.642l6.76 6.653 6.762-6.653a.375.375 0 0 0-.262-.642z"
      />
    </svg>
  );
}
