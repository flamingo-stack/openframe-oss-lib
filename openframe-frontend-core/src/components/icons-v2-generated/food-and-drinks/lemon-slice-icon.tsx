import type { SVGProps } from "react";
export interface LemonSliceIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function LemonSliceIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: LemonSliceIconProps) {
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
        d="M20.875 9.67c0-2.072-.574-4.085-1.634-5.826l-.218-.344a.81.81 0 0 0-.684-.375 1.25 1.25 0 0 0-.813.29l-.105.095L3.51 17.42a1.27 1.27 0 0 0-.386.919.81.81 0 0 0 .375.684l.344.218a11.205 11.205 0 0 0 13.75-1.648l.382-.402a11.2 11.2 0 0 0 2.899-7.521Zm2.25 0a13.456 13.456 0 0 1-20.45 11.493l-.414-.262C.383 19.661.562 17.187 1.92 15.83L15.83 1.92l.266-.24C17.491.547 19.74.5 20.901 2.26l.262.415a13.46 13.46 0 0 1 1.962 6.995"
      />
      <path
        fill={color}
        d="M16.21 2.006c.298 0 .584.119.795.33a10.373 10.373 0 1 1-14.67 14.668 1.125 1.125 0 0 1 0-1.59l13.08-13.079.171-.14c.184-.122.4-.19.624-.19ZM4.777 16.152a8.1 8.1 0 0 0 3.767 1.56v-5.326zm6.017 1.56a8.1 8.1 0 0 0 3.766-1.56l-3.766-3.766zm5.357-3.15a8.1 8.1 0 0 0 1.56-3.767h-5.326zm-3.766-6.017h5.326a8.1 8.1 0 0 0-1.56-3.768z"
      />
    </svg>
  );
}
