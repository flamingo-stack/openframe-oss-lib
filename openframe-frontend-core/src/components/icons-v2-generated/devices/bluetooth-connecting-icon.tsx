import type { SVGProps } from "react";
export interface BluetoothConnectingIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function BluetoothConnectingIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: BluetoothConnectingIconProps) {
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
        d="m16.003 10.875.115.006a1.126 1.126 0 0 1 0 2.238l-.115.006h-.005a1.125 1.125 0 0 1 0-2.25zm2.997 0 .115.006a1.125 1.125 0 0 1 0 2.238l-.114.006h-.006a1.125 1.125 0 0 1 0-2.25zm2.997 0a1.125 1.125 0 1 1 0 2.25h-.005a1.126 1.126 0 0 1 0-2.25z"
      />
      <path
        fill={color}
        d="M7.876 4.256c0-1.865 2.05-3.003 3.632-2.014l4.555 2.847c1.324.828 1.408 2.689.249 3.646l-.25.179-4.94 3.09 4.94 3.089c1.413.883 1.413 2.94 0 3.824l-4.554 2.848c-1.582.989-3.632-.15-3.632-2.014v-5.688L2.608 17.45a1.125 1.125 0 1 1-1.216-1.893l5.527-3.555-5.527-3.555-.094-.067a1.126 1.126 0 0 1 1.21-1.883l.1.058 5.268 3.386zm2.264 15.56q.015.024.05.045a.13.13 0 0 0 .063.017.1.1 0 0 0 .063-.02l4.554-2.848.003-.003v-.004L14.87 17l-4.744-2.968v5.719a.1.1 0 0 0 .014.064Zm-.014-9.843 4.744-2.966.003-.003v-.006l-.003-.002-4.554-2.847a.1.1 0 0 0-.063-.02.13.13 0 0 0-.063.017.14.14 0 0 0-.05.045.1.1 0 0 0-.014.065z"
      />
    </svg>
  );
}
