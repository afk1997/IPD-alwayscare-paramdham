// icons.jsx — Minimal stroke icon set tuned for mobile UI.
// All icons accept { size, color, stroke } props. Default stroke=1.6, color=currentColor.

const Ic = {};

const mk = (paths, vb = 24) => ({ size = 22, color = 'currentColor', stroke = 1.8, style }) => (
  <svg width={size} height={size} viewBox={`0 0 ${vb} ${vb}`} fill="none" stroke={color}
       strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={style}>
    {paths}
  </svg>
);

Ic.Home      = mk(<><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></>);
Ic.Paw       = mk(<><circle cx="5.5" cy="10" r="1.6"/><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="18.5" cy="10" r="1.6"/><path d="M7 17c0-3 2-5 5-5s5 2 5 5c0 2-2 3-5 3s-5-1-5-3z"/></>);
Ic.Plus      = mk(<><path d="M12 5v14M5 12h14"/></>);
Ic.Doc       = mk(<><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6"/></>);
Ic.Chart     = mk(<><path d="M4 4v16h16"/><path d="M8 16l3-3 3 2 4-6"/></>);
Ic.Search    = mk(<><circle cx="11" cy="11" r="6"/><path d="M20 20l-4-4"/></>);
Ic.Back      = mk(<><path d="M15 5l-7 7 7 7"/></>);
Ic.Close     = mk(<><path d="M6 6l12 12M18 6L6 18"/></>);
Ic.Camera    = mk(<><path d="M4 8h3l2-2h6l2 2h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></>);
Ic.Upload    = mk(<><path d="M12 16V4M7 9l5-5 5 5"/><path d="M5 20h14"/></>);
Ic.Filter    = mk(<><path d="M4 5h16l-6 8v5l-4 2v-7L4 5z"/></>);
Ic.Bell      = mk(<><path d="M6 17V11a6 6 0 1112 0v6"/><path d="M4 17h16"/><path d="M10 20a2 2 0 004 0"/></>);
Ic.Chevron   = mk(<><path d="M9 5l7 7-7 7"/></>);
Ic.Check     = mk(<><path d="M5 12l5 5L20 6"/></>);
Ic.Warn      = mk(<><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/></>);
Ic.Heart     = mk(<><path d="M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z"/></>);
Ic.Pill      = mk(<><rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-30 12 12)"/><path d="M8.5 7.5l4 7" /></>);
Ic.Steth     = mk(<><path d="M5 4v6a4 4 0 008 0V4"/><circle cx="17" cy="14" r="2.5"/><path d="M9 14v2a6 6 0 0010 0v-.5"/></>);
Ic.Microscope= mk(<><path d="M7 18h10"/><path d="M9 4l4 4-3 3-4-4z"/><path d="M11 9l5 5"/><path d="M14 18a5 5 0 005-5"/></>);
Ic.Scalpel   = mk(<><path d="M14 4l6 6-9 9H5v-6z"/><path d="M9 14l5 5"/></>);
Ic.Bowl      = mk(<><path d="M3 11h18a9 9 0 01-18 0z"/><path d="M3 11l1 5a3 3 0 003 2h10a3 3 0 003-2l1-5"/><path d="M8 8c0-2 1-3 2-3M12 8c0-2 1-3 2-3"/></>);
Ic.Drop      = mk(<><path d="M12 3s-6 7-6 11a6 6 0 0012 0c0-4-6-11-6-11z"/></>);
Ic.Walk      = mk(<><circle cx="13" cy="4.5" r="1.5"/><path d="M10 21l2-7 3 2 1 4"/><path d="M9 13l3-4 3 1 3 3"/><path d="M8 9l-2 4"/></>);
Ic.Soap      = mk(<><rect x="5" y="9" width="14" height="11" rx="2"/><path d="M9 9V6a3 3 0 016 0v3"/><circle cx="10" cy="14" r="0.5"/><circle cx="14" cy="16" r="0.5"/></>);
Ic.Xray      = mk(<><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 12h16M12 4v16"/></>);
Ic.User      = mk(<><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/></>);
Ic.Phone     = mk(<><path d="M5 4h4l2 5-3 2a11 11 0 005 5l2-3 5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/></>);
Ic.Calendar  = mk(<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></>);
Ic.Clock     = mk(<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>);
Ic.Edit      = mk(<><path d="M14 4l6 6-12 12H2v-6z"/></>);
Ic.Trash     = mk(<><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/></>);
Ic.Pin       = mk(<><path d="M12 21s7-6 7-12a7 7 0 10-14 0c0 6 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/></>);
Ic.Info      = mk(<><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 8v.5"/></>);
Ic.Sparkle   = mk(<><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/></>);
Ic.Cow       = mk(<><path d="M5 9c-1-1-1-3 1-3l2 1M19 9c1-1 1-3-1-3l-2 1"/><path d="M6 9c0 5 3 9 6 9s6-4 6-9"/><circle cx="10" cy="12" r="0.6" fill="currentColor"/><circle cx="14" cy="12" r="0.6" fill="currentColor"/><path d="M11 16h2"/></>);
Ic.Bird      = mk(<><path d="M4 14c4 0 6-2 8-5 1 3 4 5 8 4-2 4-5 6-9 6-3 0-6-2-7-5z"/><circle cx="17" cy="9" r="0.7" fill="currentColor"/></>);
Ic.Dog       = mk(<><path d="M5 12V8l3-2 1 2h6l1-2 3 2v4"/><path d="M5 12c0 5 3 8 7 8s7-3 7-8"/><circle cx="10" cy="14" r="0.6" fill="currentColor"/><circle cx="14" cy="14" r="0.6" fill="currentColor"/></>);
Ic.Cat       = mk(<><path d="M5 5l2 4h10l2-4-1 7c0 5-3 7-6 7s-6-2-6-7z"/><circle cx="10" cy="13" r="0.6" fill="currentColor"/><circle cx="14" cy="13" r="0.6" fill="currentColor"/></>);
Ic.Death     = mk(<><circle cx="12" cy="9" r="6"/><circle cx="9.5" cy="9" r="1" fill="currentColor"/><circle cx="14.5" cy="9" r="1" fill="currentColor"/><path d="M9 13h6"/><path d="M7 19h10"/></>);
Ic.Discharge = mk(<><path d="M14 4l6 8-6 8"/><path d="M4 12h16"/><path d="M4 4v16"/></>);
Ic.Surgery   = mk(<><path d="M4 14l6-6 4 4-6 6H4z"/><path d="M14 8l4-4 2 2-4 4"/><path d="M3 20h6"/></>);
Ic.Sort      = mk(<><path d="M6 4v16M3 17l3 3 3-3"/><path d="M18 20V4M15 7l3-3 3 3"/></>);
Ic.Copy      = mk(<><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2"/></>);
Ic.More      = mk(<><circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="19" cy="12" r="1.4" fill="currentColor"/></>);

window.Ic = Ic;

function speciesIcon(s) {
  const m = { Dog: Ic.Dog, Cat: Ic.Cat, Cow: Ic.Cow, Bird: Ic.Bird };
  return m[s] || Ic.Paw;
}
window.speciesIcon = speciesIcon;
