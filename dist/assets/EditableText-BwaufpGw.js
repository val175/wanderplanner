import{r,j as l}from"./index-BdsPGPNx.js";function w({value:e,displayValue:f,onSave:b,tag:m="span",className:g="",inputClassName:E="",placeholder:u="Click to edit...",multiline:o=!1,readOnly:x=!1}){const[c,d]=r.useState(!1),[n,s]=r.useState(e),i=r.useRef(null);r.useEffect(()=>{var t,a;c&&i.current&&(i.current.focus(),(a=(t=i.current).select)==null||a.call(t))},[c]),r.useEffect(()=>{s(e)},[e]);const p=()=>{d(!1);const t=(n==null?void 0:n.trim())??"";t!==e&&b(t)},h=t=>{t.key==="Enter"&&!o&&(t.preventDefault(),p()),t.key==="Escape"&&(s(e),d(!1))};if(c){const t=o?"textarea":"input";return l.jsx(t,{ref:i,value:n,onChange:a=>s(a.target.value),onBlur:p,onKeyDown:h,placeholder:u,className:`
          bg-bg-input border border-border rounded-[var(--radius-md)]
          px-2 py-1.5 outline-none focus:border-accent transition-colors
          text-text-primary text-sm
          ${o?"min-h-[80px] resize-y w-full":""}
          ${E}
        `,rows:o?3:void 0})}return l.jsx(m,{onClick:()=>{x||(s(e),d(!0))},className:`
        block max-w-full min-w-0 align-top rounded-[var(--radius-md)] px-1 -mx-1 border border-transparent
        ${x?"cursor-default":"cursor-pointer hover:border-border/50 hover:bg-bg-hover"} transition-colors duration-150
        ${e?"":"text-text-muted italic"}
        ${g}
      `,title:"Click to edit",children:f!==void 0?f:e||u})}export{w as E};
