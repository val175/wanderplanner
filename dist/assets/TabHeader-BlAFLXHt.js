import{r as s,j as t}from"./index-CYw-0TZa.js";function i({leftSlot:a,rightSlot:d}){const[l,o]=s.useState(!1),n=s.useRef(null);return s.useEffect(()=>{var m;const e=(m=n.current)==null?void 0:m.closest('[role="tabpanel"]');if(!e)return;const r=()=>{o(e.scrollTop>10)};return r(),e.addEventListener("scroll",r),()=>e.removeEventListener("scroll",r)},[]),t.jsxs("div",{ref:n,className:`
      flex flex-col gap-2
      md:flex-row md:items-center md:justify-between
      md:sticky md:top-[-20px] lg:top-[-28px] md:z-10 md:-mx-8 md:px-8 md:py-3 md:mb-5
      md:border-b md:transition-colors md:duration-300
      ${l?"md:bg-bg-primary/95 md:backdrop-blur-sm md:border-border":"md:bg-transparent md:border-transparent pb-3 mb-4"}
    `,children:[t.jsx("div",{className:"flex items-center gap-3 shrink-0",children:a}),d&&t.jsx("div",{className:"flex items-center gap-2 flex-wrap min-w-0 md:flex-nowrap md:justify-end gap-y-1.5",children:d})]})}export{i as T};
