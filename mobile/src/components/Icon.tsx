import type { SVGProps } from "react";

type IconName = "brand" | "qr" | "monitor" | "arrow" | "link" | "check" | "alert" | "keyboard" | "flash" | "close" | "refresh" | "shield" | "download" | "camera";

export default function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    brand: <path d="M4 10V5h5m10 0h5v5M4 18v5h5m10 0h5v-5M9 10v8m4-8v8m3-8v8m3-8v8" />,
    qr: <><path d="M3 9V3h6m6 0h6v6M3 15v6h6m12-6v6h-6" /><path d="M7 7h3v3H7zm7 0h3v3h-3zm-7 7h3v3H7zm7 0h3v3h-3z" /></>,
    monitor: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8m-4-4v4M7 9h6m-6 3h3" /></>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    link: <><path d="m10 14 4-4m-6 7-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 8a4 4 0 0 0 6 0l4-4a4 4 0 0 0-6-6l-1 1" transform="translate(1 0) scale(.9)" /></>,
    check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>,
    alert: <><path d="m12 3 10 17H2L12 3Z" /><path d="M12 9v4m0 3h.01" /></>,
    keyboard: <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M7 16h10" /></>,
    flash: <path d="m13 2-9 12h7l-1 8 10-13h-7l1-7Z" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6 6a8 8 0 0 1 13 2M5 16a8 8 0 0 0 13 2" /></>,
    shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" /><path d="m8 12 3 3 5-6" /></>,
    download: <><path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4" /></>,
    camera: <><path d="M8 5 10 3h4l2 2h4v15H4V5h4Z" /><circle cx="12" cy="12" r="4" /></>
  };
  return <svg viewBox={name === "brand" ? "0 0 28 28" : "0 0 24 24"} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>{paths[name]}</svg>;
}
