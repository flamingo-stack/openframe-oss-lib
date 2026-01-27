import type { SVGProps } from "react";
export interface ChevronCircleUpIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ChevronCircleUpIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ChevronCircleUpIconProps) {
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
        d="M20.875 12a8.875 8.875 0 1 0-17.75 0 8.875 8.875 0 0 0 17.75 0m2.25 0c0 6.144-4.98 11.124-11.124 11.125S.875 18.145.875 12 5.856.875 12.001.875c6.143 0 11.124 4.981 11.124 11.126Z"
      />
      <path
        fill={color}
        d="M12 8.375c.299 0 .585.119.796.33l3.999 4 .078.085a1.126 1.126 0 0 1-1.583 1.582l-.086-.076L12 11.09l-3.204 3.205a1.125 1.125 0 0 1-1.59-1.59l4-4.001.171-.141c.184-.122.4-.189.625-.189Z"
      />
    </svg>
  );
}
