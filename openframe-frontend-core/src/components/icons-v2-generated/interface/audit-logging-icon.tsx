import type { SVGProps } from "react";
export interface AuditLoggingIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AuditLoggingIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: AuditLoggingIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 90 90"
      width={size}
      height={size}
      className={className}
      {...props}
    >
      <path
        fill="var(--ods-open-yellow-base)"
        d="M52.5 26.5a.5.5 0 0 0 0 1zm-15 1a.5.5 0 0 0 0-1zm1.854 21.146a.5.5 0 0 0-.708.708zM43 53l-.354.354a.5.5 0 0 0 .708 0zm9.354-8.646a.5.5 0 0 0-.708-.708zM61 33h-.5v26h1V33zm-6 32v-.5H35v1h20zm-26-6h.5V33h-1v26zm23.5-32v.5H55v-1h-2.5zM35 27v.5h2.5v-1H35zm0 38v-.5a5.5 5.5 0 0 1-5.5-5.5h-1a6.5 6.5 0 0 0 6.5 6.5zm26-6h-.5a5.5 5.5 0 0 1-5.5 5.5v1a6.5 6.5 0 0 0 6.5-6.5zm0-26h.5a6.5 6.5 0 0 0-6.5-6.5v1a5.5 5.5 0 0 1 5.5 5.5zm-32 0h.5a5.5 5.5 0 0 1 5.5-5.5v-1a6.5 6.5 0 0 0-6.5 6.5zm12-8v.5h8v-1h-8zm12 4h-.5v2h1v-2zm-1 3v-.5H38v1h14zm-15-1h.5v-2h-1v2zm1 1v-.5a.5.5 0 0 1-.5-.5h-1a1.5 1.5 0 0 0 1.5 1.5zm15-1h-.5a.5.5 0 0 1-.5.5v1a1.5 1.5 0 0 0 1.5-1.5zm-4-6v.5a3.5 3.5 0 0 1 3.5 3.5h1a4.5 4.5 0 0 0-4.5-4.5zm-8 0v-.5a4.5 4.5 0 0 0-4.5 4.5h1a3.5 3.5 0 0 1 3.5-3.5zm-2 24-.354.354 4 4L43 53l.354-.354-4-4zm4 4 .354.354 9-9L52 44l-.354-.354-9 9z"
      />
    </svg>
  );
}
