import type { SVGProps } from "react";
export interface CartaIconProps
    extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
    className?: string;
    size?: number;
    color?: string;
}
export function CartaIcon({
    className = "",
    size = 24,
    color = 'var(--ods-system-greys-white)',
    ...props
}: CartaIconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill={color}
            viewBox="0 0 301.1 131.3"
            width={size}
            height={size}
            className={className}
            {...props}
        >
            <path d="M0 0v131.3h301.1V0zm293.1 123.3H8V8h285.1zM43.6 68.9c0-14.8 12.5-23.6 23.7-23.6 8 0 15.5 3 19.5 10l-7.5 4.4c-1.3-2-3.1-3.6-5.1-4.7-2.1-1.1-4.4-1.7-6.7-1.7-6.6 0-14.4 5.2-14.4 15.4 0 10 7.5 15.5 15 15.5 5.2 0 9.6-2.9 12.2-7.5l7.6 3.6c-4.3 7.8-12.1 12-21.1 12-11.3 0-23.2-8.7-23.2-23.4m70.9 23.4c6.2 0 12.1-2.8 15.1-6.8V91h9.2V46.5h-9.2V52c-2.9-4-8.9-6.7-15.1-6.7-13.6 0-23.1 10-23.1 23.5 0 13.3 9.6 23.5 23.1 23.5m.9-38.5c8.5 0 14.4 6.4 14.4 15s-5.9 15-14.4 15c-8.7 0-14.6-6.5-14.6-15.2 0-8.5 6.1-14.8 14.6-14.8m70.2 1.3h-7.1v-8.9h7.2V33h9.5v13.2h9.9v8.9h-9.9V91h-9.6zm45.8 37.2c6.2 0 12.1-2.8 15.1-6.8V91h9.2V46.5h-9.2V52c-2.9-4-8.9-6.7-15.1-6.7-13.6 0-23.1 10-23.1 23.5 0 13.3 9.6 23.5 23.1 23.5m.9-38.5c8.5 0 14.4 6.4 14.4 15s-5.9 15-14.4 15c-8.7 0-14.6-6.5-14.6-15.2 0-8.5 6.1-14.8 14.6-14.8M158 91h-9.6V46.4h8.8v7.7c1.8-5 5.7-8.4 10.8-8.4q1.65 0 3.3.3v8.6c-7.2-.8-13.2 4.2-13.2 15.7V91z" />
        </svg>
    );
}
