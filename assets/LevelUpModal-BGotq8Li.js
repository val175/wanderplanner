import{r as s,j as e}from"./index-AZmVMSvi.js";function i({event:l,onClose:t}){const{newLevel:r}=(l==null?void 0:l.detail)||{},a=s.useRef(null);return s.useEffect(()=>(a.current=setTimeout(t,5e3),()=>clearTimeout(a.current)),[t]),r?e.jsxs("div",{className:"fixed inset-0 z-[9999] flex items-center justify-center",style:{backdropFilter:"blur(12px)",background:"rgba(0,0,0,0.6)"},onClick:t,children:[e.jsxs("div",{className:"relative flex flex-col items-center gap-5 px-10 py-12 rounded-3xl text-center",style:{background:"var(--color-bg-card)",border:`2px solid ${r.frameColor}`,boxShadow:`0 0 60px ${r.frameColor}55, 0 0 120px ${r.frameColor}22`,maxWidth:400,animation:"levelUpBounce 0.5s cubic-bezier(0.34,1.56,0.64,1) both"},onClick:o=>o.stopPropagation(),children:[e.jsx("div",{className:"absolute inset-0 rounded-3xl pointer-events-none",style:{border:`1px solid ${r.frameColor}44`,animation:"levelUpPulse 2s ease-in-out infinite"}}),e.jsx("div",{style:{fontSize:72,lineHeight:1,animation:"levelUpSpin 0.6s ease-out"},children:r.emoji}),e.jsxs("div",{className:"px-4 py-1 rounded-full text-white text-xs font-bold uppercase tracking-widest",style:{background:r.frameColor},children:["Level ",r.level]}),e.jsxs("div",{children:[e.jsx("h2",{className:"font-heading text-4xl font-bold tracking-tight",style:{color:r.frameColor},children:r.title}),e.jsx("p",{className:"text-text-secondary text-sm mt-1",children:"You leveled up!"})]}),e.jsx("p",{className:"text-text-muted text-xs leading-relaxed max-w-[240px]",children:"Your frame, map marker and Wanda personality have been upgraded."}),e.jsx("button",{onClick:t,className:"mt-2 px-6 py-2.5 rounded-full text-sm font-semibold text-white transition-transform active:scale-95",style:{background:r.frameColor},children:"Keep exploring! ✈️"}),e.jsx("div",{className:"w-full h-0.5 rounded-full overflow-hidden bg-border/30 mt-2",children:e.jsx("div",{className:"h-full rounded-full",style:{background:r.frameColor,animation:"levelUpTimer 5s linear forwards",transformOrigin:"left"}})})]}),e.jsx("style",{children:`
        @keyframes levelUpBounce {
          from { opacity: 0; transform: scale(0.7) translateY(20px); }
          to   { opacity: 1; transform: scale(1)   translateY(0); }
        }
        @keyframes levelUpSpin {
          from { transform: rotate(-20deg) scale(0.6); }
          to   { transform: rotate(0deg)  scale(1); }
        }
        @keyframes levelUpPulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50%       { opacity: 0.8; transform: scale(1.01); }
        }
        @keyframes levelUpTimer {
          from { transform: scaleX(1); }
          to   { transform: scaleX(0); }
        }
      `})]}):null}export{i as default};
