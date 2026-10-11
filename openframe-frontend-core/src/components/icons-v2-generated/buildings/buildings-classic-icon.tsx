import type { SVGProps } from "react";
export interface BuildingsClassicIconProps
    extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
    className?: string;
    size?: number;
    color?: string;
}
export function BuildingsClassicIcon({
    className = "",
    size = 24,
    color = 'white',
    ...props
}: BuildingsClassicIconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 64 64"
            width={size}
            height={size}
            className={className}
            {...props}
        >
            <path
                fill={color}
                d="M58.665 56.5a.5.5 0 0 0 0-1v1m-53.333-1a.5.5 0 0 0 0 1v-1m13.333-36.333a.5.5 0 0 0 0-1v1m-2.666-1a.5.5 0 1 0 0 1v-1m32 11.666a.5.5 0 1 0 0-1v1m-2.667-1a.5.5 0 0 0 0 1v-1m-26.667 1a.5.5 0 1 0 0-1v1m-2.666-1a.5.5 0 0 0 0 1v-1m32 11.667a.5.5 0 0 0 0-1v1m-2.667-1a.5.5 0 0 0 0 1v-1m-16-20.333a.5.5 0 1 0 0-1v1m-2.667-1a.5.5 0 1 0 0 1v-1m2.667 11.666a.5.5 0 1 0 0-1v1m-2.667-1a.5.5 0 1 0 0 1v-1M27.5 56a.5.5 0 0 0 1 0h-1m-10.667 0a.5.5 0 0 0 1 0h-1m12.5-48v-.5H15.999v1h13.333zM7.999 16h-.5v40h1V16zm29.333 40h.5V18.667h-1V56zm0-37.333h.5V16h-1v2.667zm0 0v.5h13.333v-1H37.332zM58.665 56v-.5H56v1h2.666zM56 56v-.5H37.332v1h18.667zm-18.667 0v-.5H7.999v1h29.333zM7.999 56v-.5H5.332v1h2.667zm48-32h-.5v32h1V24zm-5.334-5.333v.5A4.833 4.833 0 0 1 55.5 24h1a5.833 5.833 0 0 0-5.834-5.833zM16 8v-.5a8.5 8.5 0 0 0-8.5 8.5h1a7.5 7.5 0 0 1 7.5-7.5zm13.333 0v.5a7.5 7.5 0 0 1 7.5 7.5h1a8.5 8.5 0 0 0-8.5-8.5zM18.665 18.667v-.5H16v1h2.666zM48 29.333v-.5h-2.667v1h2.667zm-29.334 0v-.5H16v1h2.666zM48 40v-.5h-2.667v1h2.667zM29.332 18.667v-.5h-2.667v1h2.667zm0 10.666v-.5h-2.667v1h2.667zM27.999 56h.5V45.333h-1V56zM17.332 45.333h-.5V56h1V45.333zM22.665 40v-.5a5.833 5.833 0 0 0-5.833 5.833h1a4.833 4.833 0 0 1 4.833-4.833zM28 45.333h.5a5.833 5.833 0 0 0-5.834-5.833v1a4.833 4.833 0 0 1 4.834 4.833z"
            />
        </svg>
    );
}
