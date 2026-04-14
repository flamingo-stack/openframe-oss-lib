import type { SVGProps } from "react";
export interface PowershellLogoGreyIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function PowershellLogoGreyIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: PowershellLogoGreyIconProps) {
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
        d="M6.719 5c4.689.043 9.379.014 14.068.019 1.176 0 1.374.25 1.11 1.436a2211 2211 0 0 1-2.598 11.537c-.329 1.438-.707 1.713-2.23 1.716-2.265.005-4.53 0-6.795 0-2.344 0-4.69.01-7.034-.005-1.189-.008-1.405-.287-1.137-1.442.907-3.919 1.844-7.831 2.731-11.754.238-1.052.75-1.517 1.885-1.507m3.523 1.604c-.525-.578-1.088-.623-1.661-.12-.58.51-.426 1.01.057 1.526 1.055 1.127 2.082 2.28 3.119 3.424.182.201.354.412.512.595-.043.434-.387.537-.627.714a760 760 0 0 1-5.186 3.782c-.484.351-.917.724-.45 1.35.423.568.924.472 1.448.088a941 941 0 0 1 7.016-5.107c.611-.44.74-.844.185-1.437-1.487-1.59-2.95-3.203-4.413-4.815m4.98 9.765a90 90 0 0 0-4.142.002c-.502.014-.754.387-.76.884-.007.526.296.805.798.828.63.028 1.262.007 1.894.007v-.006c.71 0 1.421.032 2.129-.01.561-.034.837-.438.84-.959.003-.454-.32-.737-.76-.746"
      />
    </svg>
  );
}
