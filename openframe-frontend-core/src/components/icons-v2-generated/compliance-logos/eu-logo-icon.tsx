import type { SVGProps } from "react";
export interface EuLogoIconProps
    extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
    className?: string;
    size?: number;
    color?: string;
}
export function EuLogoIcon({
    className = "",
    size = 24,
    color = "currentColor",
    ...props
}: EuLogoIconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            xmlnsXlink="http://www.w3.org/1999/xlink"
            width={size}
            height={size}
            className={className}
            {...props}
        >
            <path fill="#039" d="M0 0h900v600H0z" />
            <g fill="#fc0" transform="translate(450 300)">
                <path
                    id="eu-logo_svg__a"
                    d="m0 162.5 22.042 67.838-57.707-41.926h71.33l-57.707 41.926z"
                />
                <use xlinkHref="#eu-logo_svg__a" y={-400} />
                <g id="eu-logo_svg__b">
                    <use
                        xlinkHref="#eu-logo_svg__a"
                        transform="translate(-100 -26.795)"
                    />
                    <use
                        xlinkHref="#eu-logo_svg__a"
                        transform="translate(-173.205 -100)"
                    />
                    <use
                        xlinkHref="#eu-logo_svg__a"
                        transform="translate(-200 -200)"
                    />
                    <use
                        xlinkHref="#eu-logo_svg__a"
                        transform="translate(-173.205 -300)"
                    />
                    <use
                        xlinkHref="#eu-logo_svg__a"
                        transform="translate(-100 -373.205)"
                    />
                </g>
                <use xlinkHref="#eu-logo_svg__b" transform="scale(-1 1)" />
            </g>
        </svg>
    );
}
