import type { SVGProps } from "react";
export interface HamburgerCheeseIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function HamburgerCheeseIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: HamburgerCheeseIconProps) {
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
        d="M20.5 16.875c.81 0 1.593.637 1.603 1.552l-.009.186c-.17 1.681-1.042 2.862-2.244 3.581-1.152.69-2.554.93-3.85.93H8c-1.296 0-2.698-.24-3.85-.93-1.202-.72-2.074-1.9-2.244-3.581-.103-1.013.73-1.737 1.594-1.738zm-16.18 2.25c.2.513.543.874.986 1.139.68.407 1.634.61 2.694.61h8c1.06 0 2.014-.203 2.694-.61.443-.265.786-.626.986-1.139zm7.68-16c-4.382 0-7.785 3.492-7.87 6.75h15.74c-.085-3.258-3.488-6.75-7.87-6.75m10.125 7.376c0 .897-.727 1.624-1.625 1.624h-17a1.625 1.625 0 0 1-1.625-1.624V10C1.875 5.293 6.497.875 12 .875S22.125 5.293 22.125 10z"
      />
      <path
        fill={color}
        d="M21 13.376a1.125 1.125 0 0 1 0 2.25H3a1.125 1.125 0 0 1 0-2.25zM17.875 7.5a1.376 1.376 0 0 1-2.743.14l-.008-.14.008-.14A1.376 1.376 0 0 1 16.5 6.124l.14.007c.694.07 1.235.656 1.235 1.368Zm-9 0a1.376 1.376 0 0 1-2.743.14l-.007-.14.007-.14A1.376 1.376 0 0 1 7.5 6.124l.14.007c.694.07 1.235.656 1.235 1.368Zm4.5-2a1.375 1.375 0 0 1-2.743.141l-.008-.14.008-.141a1.375 1.375 0 0 1 2.744.14Z"
      />
    </svg>
  );
}
