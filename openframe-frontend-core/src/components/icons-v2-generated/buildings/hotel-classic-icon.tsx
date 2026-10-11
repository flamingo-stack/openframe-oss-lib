import type { SVGProps } from "react";
export interface HotelClassicIconProps
    extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
    className?: string;
    size?: number;
    color?: string;
}
export function HotelClassicIcon({
    className = "",
    size = 24,
    color = 'white',
    ...props
}: HotelClassicIconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 65 64"
            width={size}
            height={size}
            className={className}
            {...props}
        >
            <path
                fill={color}
                d="M59.333 56.5a.5.5 0 1 0 0-1v1M6 55.5a.5.5 0 0 0 0 1v-1m0-48a.5.5 0 0 0 0 1v-1m34.667 1a.5.5 0 0 0 0-1v1m18.666 10.667a.5.5 0 1 0 0-1v1m-40 0a.5.5 0 1 0 0-1v1m-2.666-1a.5.5 0 1 0 0 1v-1m32 11.666a.5.5 0 1 0 0-1v1m-2.667-1a.5.5 0 0 0 0 1v-1m-26.667 1a.5.5 0 1 0 0-1v1m-2.666-1a.5.5 0 1 0 0 1v-1m32 11.667a.5.5 0 0 0 0-1v1M46 39.5a.5.5 0 0 0 0 1v-1M30 19.167a.5.5 0 0 0 0-1v1m-2.667-1a.5.5 0 1 0 0 1v-1M30 29.833a.5.5 0 1 0 0-1v1m-2.667-1a.5.5 0 0 0 0 1v-1M28.167 56a.5.5 0 1 0 1 0h-1M17.5 56a.5.5 0 0 0 1 0h-1M38 8v-.5H8.667v1H38zM8.667 8h-.5v48h1V8zM38 56h.5V18.667h-1V56zm0-37.333h.5V8h-1v10.667zm0 0v.5h18.667v-1H38zM59.333 56v-.5h-2.666v1h2.666zm-2.666 0v-.5H38v1h18.667zM38 56v-.5H8.667v1H38zM8.667 56v-.5H6v1h2.667zm48-37.333h-.5V56h1V18.667zM6 8v.5h2.667v-1H6zm32 0v.5h2.667v-1H38zm18.667 10.667v.5h2.666v-1h-2.666zm-37.334 0v-.5h-2.666v1h2.666zm29.334 10.666v-.5H46v1h2.667zm-29.334 0v-.5h-2.666v1h2.666zM48.667 40v-.5H46v1h2.667zM30 18.667v-.5h-2.667v1H30zm0 10.666v-.5h-2.667v1H30zM28.667 56h.5V45.333h-1V56zM18 45.333h-.5V56h1V45.333zM23.333 40v-.5a5.833 5.833 0 0 0-5.833 5.833h1a4.833 4.833 0 0 1 4.833-4.833zm5.334 5.333h.5a5.833 5.833 0 0 0-5.834-5.833v1a4.833 4.833 0 0 1 4.834 4.833z"
            />
            {"\xDF"}
        </svg>
    );
}
