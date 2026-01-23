import type { SVGProps } from "react";
export interface LightningIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function LightningIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: LightningIconProps) {
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
        d="M12.14 1.369c1.016-1.063 2.838-.298 2.79 1.172l-.011.149-.656 5.685h5.734c1.282 0 2.026 1.392 1.407 2.442l-.144.205-9.302 11.498c-1.023 1.264-3.063.407-2.877-1.209l.657-5.686H4.003c-1.367 0-2.123-1.585-1.263-2.647l9.302-11.496zM5.312 13.375h5.127c.972 0 1.726.847 1.615 1.812l-.491 4.242 7.125-8.804H13.56a1.625 1.625 0 0 1-1.614-1.812l.489-4.244z"
      />
    </svg>
  );
}
