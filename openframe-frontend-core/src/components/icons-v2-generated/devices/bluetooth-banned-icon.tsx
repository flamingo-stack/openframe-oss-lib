import type { SVGProps } from "react";
export interface BluetoothBannedIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function BluetoothBannedIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: BluetoothBannedIconProps) {
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
        d="M7.876 19.75v-5.687L2.608 17.45a1.125 1.125 0 1 1-1.216-1.893l5.527-3.555-5.527-3.555-.094-.067a1.126 1.126 0 0 1 1.21-1.883l.1.058 5.268 3.386V4.256c0-1.865 2.05-3.003 3.632-2.014l4.555 2.847c1.324.828 1.408 2.689.249 3.646l-.25.179-4.94 3.09.852.533.094.065a1.125 1.125 0 0 1-1.186 1.897l-.1-.055-.656-.412v5.719q.002.044.011.058a.1.1 0 0 0 .035.041c.04.03.08.032.106.025a1.125 1.125 0 0 1 .587 2.171c-1.44.39-2.99-.669-2.99-2.295Zm2.25-9.777 4.744-2.966.003-.003v-.006l-.003-.002-4.554-2.847a.1.1 0 0 0-.063-.02.13.13 0 0 0-.063.017.14.14 0 0 0-.05.045.1.1 0 0 0-.014.065z"
      />
      <path
        fill={color}
        d="M20.875 18a2.875 2.875 0 0 0-3.95-2.666l3.74 3.74c.134-.332.21-.694.21-1.074m-5.75 0a2.875 2.875 0 0 0 3.95 2.665l-3.74-3.74c-.135.332-.21.695-.21 1.075m8 0a5.124 5.124 0 1 1-10.249 0 5.124 5.124 0 0 1 10.249 0"
      />
    </svg>
  );
}
