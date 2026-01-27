import type { SVGProps } from "react";
export interface SignalBroadcast01IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function SignalBroadcast01Icon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: SignalBroadcast01IconProps) {
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
        d="M6.937 8.149A1.125 1.125 0 0 1 8.49 9.772l-.202.237c-.884 1.152-.884 2.83 0 3.982l.202.237.075.088a1.125 1.125 0 0 1-1.63 1.535l-.081-.079-.18-.2c-1.788-2.1-1.729-5.32.18-7.344l.082-.08Zm8.625.032a1.125 1.125 0 0 1 1.507-.032l.084.079.178.2c1.789 2.1 1.73 5.32-.178 7.344a1.126 1.126 0 0 1-1.638-1.544c1.08-1.147 1.148-2.985.202-4.219l-.202-.237-.075-.088a1.125 1.125 0 0 1 .122-1.503"
      />
      <path
        fill={color}
        d="M3.526 5.228a1.126 1.126 0 0 1 1.638 1.544c-2.63 2.79-2.711 7.284-.246 10.18l.246.276.075.088a1.126 1.126 0 0 1-1.63 1.535l-.083-.079-.32-.359c-3.207-3.765-3.1-9.555.32-13.185m15.362-.047a1.126 1.126 0 0 1 1.508-.032l.083.079.32.359c3.208 3.765 3.101 9.555-.32 13.185a1.126 1.126 0 0 1-1.638-1.544c2.63-2.79 2.713-7.284.248-10.18l-.248-.276-.074-.088a1.126 1.126 0 0 1 .121-1.503M12.22 9.886a2.125 2.125 0 1 1-2.33 2.33L9.878 12l.012-.217a2.126 2.126 0 0 1 2.114-1.908z"
      />
    </svg>
  );
}
