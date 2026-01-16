import type { SVGProps } from "react";
export interface BluetoothOffIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function BluetoothOffIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: BluetoothOffIconProps) {
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
        d="M10.875 6.348V4.256c0-1.865 2.052-3.004 3.634-2.014l4.555 2.847.247.179a2.257 2.257 0 0 1 0 3.467l-.247.179-2.987 1.868-.101.055a1.125 1.125 0 0 1-1.093-1.963l2.988-1.867.002-.002v-.008h-.002l-4.555-2.848a.1.1 0 0 0-.062-.02.13.13 0 0 0-.064.017.13.13 0 0 0-.049.045.1.1 0 0 0-.016.065v2.092a1.125 1.125 0 0 1-2.25 0m-8.67-4.144a1.125 1.125 0 0 1 1.506-.077l.085.077 18 18 .078.085a1.125 1.125 0 0 1-1.584 1.584l-.085-.078-2.21-2.21-3.487 2.18c-1.582.99-3.632-.15-3.632-2.015v-5.688l-5.268 3.39a1.125 1.125 0 0 1-1.216-1.893l5.827-3.75-8.014-8.014-.077-.085a1.125 1.125 0 0 1 .077-1.506M13.14 19.816q.015.023.05.044a.13.13 0 0 0 .063.018.1.1 0 0 0 .063-.02l3.045-1.907-3.235-3.235v5.034c0 .035.007.054.014.066"
      />
    </svg>
  );
}
