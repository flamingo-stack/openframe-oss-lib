import type { SVGProps } from "react";
export interface AlertTriangleClassicIconProps
    extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
    className?: string;
    size?: number;
    color?: string;
}
export function AlertTriangleClassicIcon({
    className = "",
    size = 24,
    color = 'white',
    ...props
}: AlertTriangleClassicIconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill={color}
            viewBox="0 0 24 24"
            width={size}
            height={size}
            className={className}
            {...props}
        >
            <path
                stroke={color}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.29 3.86 1.82 18a2.003 2.003 0 0 0 .708 2.724c.295.177.631.272.974.276h16.987a1.94 1.94 0 0 0 .974-.276 2.02 2.02 0 0 0 .976-1.73 2 2 0 0 0-.268-.994l-8.47-14.14a2.05 2.05 0 0 0-.725-.709 1.95 1.95 0 0 0-.975-.267 1.95 1.95 0 0 0-.975.267 2.06 2.06 0 0 0-.725.709zM12 9v4M12 17h.01"
            />
        </svg>
    );
}
