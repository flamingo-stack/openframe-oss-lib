import type { SVGProps } from "react";
export interface TieIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function TieIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: TieIconProps) {
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
        d="M13.774 6.54a1.126 1.126 0 0 1 1.296.77l.028.11 1.963 9.804.052.369a3.13 3.13 0 0 1-.822 2.366l-1.996 2.16a3.127 3.127 0 0 1-4.348.238l-.241-.236-2-2.161a3.13 3.13 0 0 1-.769-2.738l1.966-9.801a1.125 1.125 0 0 1 2.206.442l-1.966 9.803a.88.88 0 0 0 .215.766l2 2.16.14.124a.876.876 0 0 0 1.145-.123l1.996-2.16.068-.081a.88.88 0 0 0 .147-.686l-1.962-9.803-.016-.114a1.125 1.125 0 0 1 .898-1.21Z"
      />
      <path
        fill={color}
        d="M10.372 1.21a4.13 4.13 0 0 1 3.477.103l1.306.653.234.134a2.625 2.625 0 0 1 .939 3.385l-1.326 2.659c-.146.294-.415.51-.734.59l-1.508.378a3.1 3.1 0 0 1-1.33.04l-.19-.04-1.507-.378A1.13 1.13 0 0 1 9 8.144l-1.325-2.66a2.625 2.625 0 0 1 1.172-3.518l1.306-.653zm2.468 2.114a1.88 1.88 0 0 0-1.478-.088l-.202.088-1.305.655a.375.375 0 0 0-.169.502l1.095 2.195 1.007.253c.14.035.286.035.425 0l1.005-.252 1.096-2.196a.376.376 0 0 0-.103-.462l-.064-.04z"
      />
    </svg>
  );
}
