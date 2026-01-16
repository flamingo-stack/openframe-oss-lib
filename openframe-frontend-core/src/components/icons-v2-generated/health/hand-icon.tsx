import type { SVGProps } from "react";
export interface HandIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function HandIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: HandIconProps) {
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
        d="M5.59 6.875c.67 0 1.335.094 1.978.28l3.14.906.197.05q.297.063.602.063h2.284a2.77 2.77 0 0 1 2.737 2.345l2.742-.988.282-.087a2.877 2.877 0 0 1 3.401 1.806l.087.281a2.875 2.875 0 0 1-1.808 3.405l-7.516 2.727a7.63 7.63 0 0 1-6.245-.47l-3.605-1.961a.9.9 0 0 0-.419-.107h-1.43a1.125 1.125 0 0 1 0-2.25h1.43c.522 0 1.036.13 1.494.38l3.605 1.962.257.13a5.38 5.38 0 0 0 4.145.201l7.516-2.727a.625.625 0 0 0 .406-.679l-.03-.123a.626.626 0 0 0-.802-.373l-.001.001-5.258 1.896-.096.035-.002-.002-.032.014a2.8 2.8 0 0 1-.858.134H9.938a1.125 1.125 0 0 1 0-2.25h3.851a.6.6 0 0 0 .159-.024l.045-.017a.525.525 0 0 0-.204-1.009h-2.283a5.1 5.1 0 0 1-1.422-.2l-3.141-.907a4.9 4.9 0 0 0-1.354-.192H2a1.125 1.125 0 0 1 0-2.25z"
      />
    </svg>
  );
}
