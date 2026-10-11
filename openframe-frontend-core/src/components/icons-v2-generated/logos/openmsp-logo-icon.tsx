import type { SVGProps } from "react";
export interface OpenmspLogoIconProps
    extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
    className?: string;
    size?: number;
    color?: string;
}
export function OpenmspLogoIcon({
    className = "",
    size = 24,
    color = '#000000',
    ...props
}: OpenmspLogoIconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 97 96"
            width={size}
            height={size}
            className={className}
            {...props}
        >
            <path
                fill="var(--icon-tertiary, #ffffff)"
                d="M73.933 0a3.2 3.2 0 0 1 3.2 3.2v51.2a3.2 3.2 0 0 1-3.2 3.2h-70.4a3.2 3.2 0 0 1-3.2-3.2V3.2a3.2 3.2 0 0 1 3.2-3.2zM10.108 47.65a.8.8 0 0 0 .8.8h55.65a.8.8 0 0 0 .8-.8V9.95a.8.8 0 0 0-.8-.8h-55.65a.8.8 0 0 0-.8.8z"
            />
            <path
                fill="var(--icon-secondary, #ffffff)"
                d="M19.533 22.4a3.2 3.2 0 0 1 3.2-3.2h70.4a3.2 3.2 0 0 1 3.2 3.2v54.4a3.2 3.2 0 0 1-2.304 3.072l-54.272 15.83a.8.8 0 0 1-1.024-.769V80a.8.8 0 0 0-.8-.8h-15.2a3.2 3.2 0 0 1-3.2-3.2z"
            />
            <path
                fill={color}
                d="M93.133 19.2a3.2 3.2 0 0 1 3.2 3.2v54.4a3.2 3.2 0 0 1-2.304 3.072l-54.272 15.83a.8.8 0 0 1-1.024-.769V80a.8.8 0 0 0-.8-.8h-15.2a3.2 3.2 0 0 1-3.2-3.2V22.4a3.2 3.2 0 0 1 3.2-3.2zM48.338 82.129a.8.8 0 0 0 1.024.771l36.795-10.733a.8.8 0 0 0 .576-.768V29.6a.8.8 0 0 0-.8-.8h-56a.8.8 0 0 0-.8.8v39.2a.8.8 0 0 0 .8.8h17.654a.8.8 0 0 1 .8.803z"
            />
            <circle cx={45.133} cy={44.8} r={6.4} fill={color} />
        </svg>
    );
}
