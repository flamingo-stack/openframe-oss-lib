import type { SVGProps } from "react";
export interface GlassWineIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function GlassWineIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: GlassWineIconProps) {
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
        d="m17.86 6.875.114.006a1.125 1.125 0 0 1 0 2.238l-.114.006H6.14a1.125 1.125 0 0 1 0-2.25z"
      />
      <path
        fill={color}
        d="M16.875 10c0-1.144-.265-3.056-.548-4.752a98 98 0 0 0-.38-2.123H8.052c-.104.547-.24 1.298-.378 2.123C7.39 6.944 7.125 8.856 7.125 10a4.875 4.875 0 0 0 9.75 0m2.25 0c0 3.552-2.6 6.496-6 7.035v3.84H15l.114.005a1.125 1.125 0 0 1 0 2.239l-.114.006H9a1.125 1.125 0 0 1 0-2.25h1.875v-3.84c-3.4-.54-6-3.483-6-7.035 0-1.357.297-3.445.577-5.123.142-.854.285-1.628.391-2.189l.13-.666.036-.182.01-.048.003-.013v-.005h.001A1.126 1.126 0 0 1 7.125.875h9.75l.196.018c.448.079.812.423.906.881l.001.002v.003l.003.013q.002.016.009.048l.036.182a100 100 0 0 1 .522 2.855c.28 1.678.577 3.766.577 5.123"
      />
    </svg>
  );
}
