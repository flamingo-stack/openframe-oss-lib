import type { SVGProps } from "react";
export interface BluetoothSearchIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function BluetoothSearchIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: BluetoothSearchIconProps) {
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
        d="M10.854 19.521a1.126 1.126 0 0 1 1.194 1.907l-.54.337c-1.582.99-3.632-.15-3.632-2.014v-5.688l-5.268 3.388a1.125 1.125 0 1 1-1.216-1.892l5.527-3.556-5.527-3.555-.094-.067a1.126 1.126 0 0 1 1.21-1.882l.1.057 5.268 3.386V4.256c0-1.865 2.05-3.003 3.632-2.014l4.555 2.847a2.257 2.257 0 0 1 .249 3.646l-.25.179-4.94 3.09 1.708 1.067.095.066a1.125 1.125 0 0 1-1.187 1.899l-.1-.057-1.512-.947v5.719a.1.1 0 0 0 .014.064.14.14 0 0 0 .05.046.13.13 0 0 0 .063.017.1.1 0 0 0 .063-.02zm-.728-9.548 4.744-2.966.003-.003v-.006l-.003-.001-4.554-2.848a.1.1 0 0 0-.063-.02.13.13 0 0 0-.063.017.14.14 0 0 0-.05.045.1.1 0 0 0-.014.065z"
      />
      <path
        fill={color}
        d="M19.875 18a1.875 1.875 0 1 0-3.75 0 1.875 1.875 0 0 0 3.75 0m2.25 0a4.1 4.1 0 0 1-.526 2.008l1.197 1.197.076.085a1.125 1.125 0 0 1-1.582 1.582l-.085-.076-1.197-1.197a4.1 4.1 0 0 1-2.008.526A4.125 4.125 0 1 1 22.125 18"
      />
    </svg>
  );
}
