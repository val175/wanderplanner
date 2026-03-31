import{r,j as b}from"./index-cJQuhxSD.js";function y({value:e,displayValue:f,onSave:m,tag:l="span",className:g="",inputClassName:E="",placeholder:u="Click to edit...",multiline:o=!1,readOnly:x=!1}){const[c,d]=r.useState(!1),[s,n]=r.useState(e),i=r.useRef(null);r.useEffect(()=>{var t,a;c&&i.current&&(i.current.focus(),(a=(t=i.current).select)==null||a.call(t))},[c]),r.useEffect(()=>{n(e)},[e]);const p=()=>{d(!1);const t=(s==null?void 0:s.trim())??"";t!==e&&m(t)},h=t=>{t.key==="Enter"&&!o&&(t.preventDefault(),p()),t.key==="Escape"&&(n(e),d(!1))};if(c){const t=o?"textarea":"input";return b.jsx(t,{ref:i,value:s,onChange:a=>n(a.target.value),onBlur:p,onKeyDown:h,placeholder:u,className:`
          bg-bg-input border border-border rounded-[var(--radius-md)]
          px-2 py-1.5 outline-none focus:border-accent transition-colors
          text-text-primary text-sm
          ${o?"min-h-[80px] resize-y w-full":""}
          ${E}
        `,rows:o?3:void 0})}return b.jsx(l,{onClick:()=>{x||(n(e),d(!0))},className:`
        rounded-[var(--radius-md)] px-1 -mx-1 border border-transparent
        ${x?"cursor-default":"cursor-pointer hover:border-border/50 hover:bg-bg-hover"} transition-colors duration-150
        ${e?"":"text-text-muted italic"}
        ${g}
      `,title:"Click to edit",children:f!==void 0?f:e||u})}export{y as E};
