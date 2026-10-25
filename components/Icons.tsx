/** Icon set from docs/design/mockups.html (24px grid, 1.8 stroke, round caps). */
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const stroke = (w = 1.8): Partial<P> => ({ fill: "none", stroke: "currentColor", strokeWidth: w, strokeLinecap: "round", strokeLinejoin: "round" });
const base = (p: P): P => ({ viewBox: "0 0 24 24", "aria-hidden": true, focusable: false, ...p });

export const IconMic = (p: P) => (<svg {...base(p)} {...stroke(1.9)}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></svg>);
export const IconMicOff = (p: P) => (<svg {...base(p)} {...stroke(1.9)}><path d="M15 10V6a3 3 0 0 0-5.7-1.3M9 9v2a3 3 0 0 0 4.9 2.3M5.5 11a6.5 6.5 0 0 0 10.6 5M18.5 11a6.5 6.5 0 0 1-.4 2.2M12 17.5V21M3 3l18 18" /></svg>);
export const IconSend = (p: P) => (<svg {...base(p)} {...stroke(2.2)}><path d="M12 19V5M6 11l6-6 6 6" /></svg>);
export const IconSettings = (p: P) => (<svg {...base(p)} {...stroke()}><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></svg>);
export const IconBack = (p: P) => (<svg {...base(p)} {...stroke(2)}><path d="M15 5l-7 7 7 7" /></svg>);
export const IconChev = (p: P) => (<svg {...base(p)} {...stroke(2)}><path d="M9 5l7 7-7 7" /></svg>);
export const IconClose = (p: P) => (<svg {...base(p)} {...stroke(2)}><path d="M6 6l12 12M18 6L6 18" /></svg>);
export const IconMore = (p: P) => (<svg {...base(p)} fill="currentColor"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>);
export const IconKbd = (p: P) => (<svg {...base(p)} {...stroke()}><rect x="3" y="6" width="18" height="12" rx="2.5" /><path d="M7 10h.01M11 10h.01M15 10h.01M17 10h.01M7 14h10" /></svg>);
export const IconPlay = (p: P) => (<svg {...base(p)} fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" /></svg>);
export const IconStop = (p: P) => (<svg {...base(p)} fill="currentColor"><rect x="6.5" y="6.5" width="11" height="11" rx="2" /></svg>);
export const IconPause = (p: P) => (<svg {...base(p)} fill="currentColor"><rect x="6.5" y="5.5" width="4" height="13" rx="1.4" /><rect x="13.5" y="5.5" width="4" height="13" rx="1.4" /></svg>);
export const IconBookmark = (p: P) => (<svg {...base(p)} {...stroke()}><path d="M6.5 4h11v16l-5.5-4-5.5 4z" /></svg>);
export const IconBookmarkFilled = (p: P) => (<svg {...base(p)} fill="currentColor" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round"><path d="M6.5 4h11v16l-5.5-4-5.5 4z" /></svg>);
export const IconCopy = (p: P) => (<svg {...base(p)} {...stroke()}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h8" /></svg>);
export const IconShare = (p: P) => (<svg {...base(p)} {...stroke()}><path d="M12 15V3M7.5 7.5L12 3l4.5 4.5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></svg>);
export const IconRedo = (p: P) => (<svg {...base(p)} {...stroke(2)}><path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6" /></svg>);
export const IconReplay = (p: P) => (<svg {...base(p)} {...stroke(2)}><path d="M4 11a8 8 0 1 1 2.3 5.7M4 5v6h6" /></svg>);
export const IconPush = (p: P) => (<svg {...base(p)} {...stroke()}><path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z" /></svg>);
export const IconSearch = (p: P) => (<svg {...base(p)} {...stroke(1.9)}><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></svg>);
export const IconConsult = (p: P) => (<svg {...base(p)} {...stroke()}><path d="M4 12h1.5M8 8v8M12 5v14M16 9v6M19.5 12H20" /></svg>);
export const IconCase = (p: P) => (<svg {...base(p)} {...stroke()}><rect x="3.5" y="7" width="17" height="12.5" rx="2.5" /><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3.5 12.5h17" /></svg>);
export const IconMail = (p: P) => (<svg {...base(p)} {...stroke()}><rect x="3" y="5.5" width="18" height="13" rx="2.5" /><path d="M4 7l8 6 8-6" /></svg>);
export const IconWifiOff = (p: P) => (<svg {...base(p)} {...stroke(1.9)}><path d="M3 3l18 18M8.5 16.4a5 5 0 0 1 6.2-.6M5 12.9a10 10 0 0 1 4.3-2.4M19 12.9a10 10 0 0 0-2.3-1.6M2 9.3a15 15 0 0 1 3.7-2.4M22 9.3A15 15 0 0 0 12 5.5c-.7 0-1.4 0-2 .1M12 20h.01" /></svg>);
export const IconAlert = (p: P) => (<svg {...base(p)} {...stroke(1.9)}><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.5h.01" /></svg>);
export const IconCheck = (p: P) => (<svg {...base(p)} {...stroke(2.2)}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>);
export const IconCaptions = (p: P) => (<svg {...base(p)} {...stroke()}><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M10.5 10.3a2.3 2.3 0 1 0 0 3.4M17 10.3a2.3 2.3 0 1 0 0 3.4" /></svg>);
export const IconTap = (p: P) => (<svg {...base(p)} {...stroke()}><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11l4.6.9a2 2 0 0 1 1.6 2.3l-.8 4.3A2 2 0 0 1 15.4 20H11a2 2 0 0 1-1.6-.8L6 14.5a1.4 1.4 0 0 1 2-2l1 1" /></svg>);
export const IconLock = (p: P) => (<svg {...base(p)} {...stroke()}><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></svg>);
export const IconPhone = (p: P) => (<svg {...base(p)} {...stroke()}><path d="M5 4h3.5l1.8 4.5-2.3 1.4a11 11 0 0 0 6.1 6.1l1.4-2.3L20 15.5V19a1.5 1.5 0 0 1-1.6 1.5A16.5 16.5 0 0 1 3.5 5.6 1.5 1.5 0 0 1 5 4z" /></svg>);
export const IconHeart = (p: P) => (<svg {...base(p)} {...stroke()}><path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" /></svg>);
export const IconBell = (p: P) => (<svg {...base(p)} {...stroke()}><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5h4" /></svg>);
export const IconDial = (p: P) => (<svg {...base(p)} {...stroke()}><path d="M4.5 16a8 8 0 1 1 15 0" /><path d="M12 12l4-3.5" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /></svg>);
export const IconThumbUp = (p: P) => (<svg {...base(p)} {...stroke()}><path d="M7 10v10H4V10zM7 10l4-7a2 2 0 0 1 2.8 2.3L13 9h5.5a2 2 0 0 1 2 2.4l-1.4 7A2 2 0 0 1 17.1 20H7" /></svg>);
export const IconThumbDown = (p: P) => (<svg {...base(p)} {...stroke()}><path d="M7 14V4H4v10zM7 14l4 7a2 2 0 0 0 2.8-2.3L13 15h5.5a2 2 0 0 0 2-2.4l-1.4-7A2 2 0 0 0 17.1 4H7" /></svg>);
export const IconDownload = (p: P) => (<svg {...base(p)} {...stroke()}><path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19h14" /></svg>);
export const IconGoogle = (p: P) => (
  <svg viewBox="0 0 48 48" aria-hidden focusable={false} {...p}>
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);
