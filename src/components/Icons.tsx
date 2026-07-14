import type { ServiceIcon } from "@/lib/site-config";
import type { ReactElement, SVGProps } from "react";

const base = {
  width: 28,
  height: 28,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const serviceIcons: Record<ServiceIcon, (p: SVGProps<SVGSVGElement>) => ReactElement> = {
  wrench: (p) => (
    <svg {...base} {...p}>
      <path d="M14.7 6.3a4 4 0 0 0-5 5L4 17v3h3l5.7-5.7a4 4 0 0 0 5-5l-2.4 2.4-2.3-.6-.6-2.3 2.3-2.5Z" />
    </svg>
  ),
  drywall: (p) => (
    <svg {...base} {...p}>
      <rect x="3" y="4" width="18" height="16" rx="1" />
      <path d="M3 10h18M9 4v6M15 10v10M9 15h6" />
    </svg>
  ),
  paint: (p) => (
    <svg {...base} {...p}>
      <rect x="3" y="3" width="13" height="7" rx="1" />
      <path d="M16 6h3a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-7v3" />
      <rect x="10" y="15" width="4" height="6" rx="1" />
    </svg>
  ),
  carpentry: (p) => (
    <svg {...base} {...p}>
      <path d="M3 7l7-3 11 4-1 3-10-3-6 2z" />
      <path d="M3 7v4l6 2M20 11l1 6-9-3v-4" />
    </svg>
  ),
  door: (p) => (
    <svg {...base} {...p}>
      <path d="M5 21V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v17" />
      <path d="M3 21h18M13 12h.01" />
    </svg>
  ),
  mount: (p) => (
    <svg {...base} {...p}>
      <rect x="3" y="4" width="18" height="12" rx="1" />
      <path d="M12 16v3M8 22h8" />
    </svg>
  ),
  faucet: (p) => (
    <svg {...base} {...p}>
      <path d="M3 13h6v-2a3 3 0 0 1 3-3h3a3 3 0 0 1 3 3" />
      <path d="M6 13v3a2 2 0 0 0 2 2h0M18 8V5M16 5h4" />
    </svg>
  ),
  electric: (p) => (
    <svg {...base} {...p}>
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
    </svg>
  ),
  tile: (p) => (
    <svg {...base} {...p}>
      <rect x="3" y="3" width="8" height="8" rx="1" />
      <rect x="13" y="3" width="8" height="8" rx="1" />
      <rect x="3" y="13" width="8" height="8" rx="1" />
      <rect x="13" y="13" width="8" height="8" rx="1" />
    </svg>
  ),
  list: (p) => (
    <svg {...base} {...p}>
      <path d="M9 5h11M9 12h11M9 19h11" />
      <path d="m3 5 1.5 1.5L7 4M3 12l1.5 1.5L7 11M3 19l1.5 1.5L7 18" />
    </svg>
  ),
};

export const PhoneIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} width={18} height={18} {...p}>
    <path d="M5 3h3l1.5 5-2 1.5a11 11 0 0 0 5 5l1.5-2 5 1.5v3a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z" />
  </svg>
);

export const ArrowIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} width={20} height={20} {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export const CheckIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} width={20} height={20} {...p}>
    <path d="m20 6-11 11-5-5" />
  </svg>
);

export const IchthysIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M21 12c-4.2-5-12.8-5-17 0 4.2 5 12.8 5 17 0Z" />
    <path d="M24 8 21 12l3 4" />
  </svg>
);

export const CrossIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M12 3v18M8 8h8" />
  </svg>
);

export const CalendarIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 9h18M8 3v4M16 3v4" />
  </svg>
);

export const ClockIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

export const ShieldIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} width={18} height={18} {...p}>
    <path d="M12 3 5 6v5c0 4 3 7 7 9 4-2 7-5 7-9V6l-7-3z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

export const StarIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" width={20} height={20} {...p}>
    <path d="m12 2 2.9 6.2 6.8.8-5 4.6 1.3 6.7L12 17.8 5.9 20.3 7.3 13.6l-5-4.6 6.8-.8L12 2z" />
  </svg>
);

export const PinIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} width={18} height={18} {...p}>
    <path d="M12 21s7-5.7 7-11a7 7 0 1 0-14 0c0 5.3 7 11 7 11z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
);

export const MailIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} width={18} height={18} {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </svg>
);

export const CameraIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} width={18} height={18} {...p}>
    <path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" />
    <circle cx="12" cy="13" r="3.5" />
  </svg>
);
