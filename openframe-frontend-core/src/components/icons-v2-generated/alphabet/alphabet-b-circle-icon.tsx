import type { SVGProps } from "react";
export interface AlphabetBCircleIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AlphabetBCircleIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: AlphabetBCircleIconProps) {
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
        d="M13.375 13.75c0-.622-.504-1.126-1.125-1.126h-1.125v2.25h1.125c.621 0 1.125-.503 1.125-1.125Zm-.5-4a.626.626 0 0 0-.625-.625h-1.125v1.25h1.125l.126-.012c.285-.058.5-.31.5-.613Zm2.25 0a2.86 2.86 0 0 1-.493 1.609 3.375 3.375 0 0 1-2.382 5.766h-2a1.375 1.375 0 0 1-1.375-1.374v-7.5c0-.76.616-1.376 1.376-1.376h1.999a2.876 2.876 0 0 1 2.876 2.875Z"
      />
    </svg>
  );
}
