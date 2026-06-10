import{r as o,j as b}from"./index-Ceg_IKvK.js";function w({value:e,displayValue:d,onSave:l,tag:m="span",className:g="",inputClassName:E="",placeholder:u="Click to edit...",multiline:n=!1,readOnly:x=!1}){const[c,f]=o.useState(!1),[s,r]=o.useState(e),i=o.useRef(null);o.useEffect(()=>{var t,a;c&&i.current&&(i.current.focus(),(a=(t=i.current).select)==null||a.call(t))},[c]),o.useEffect(()=>{r(e)},[e]);const p=()=>{f(!1);const t=(s==null?void 0:s.trim())??"";if(!t){r(e);return}t!==e&&l(t)},h=t=>{t.key==="Enter"&&!n&&(t.preventDefault(),p()),t.key==="Escape"&&(r(e),f(!1))};if(c){const t=n?"textarea":"input";return b.jsx(t,{ref:i,value:s,onChange:a=>r(a.target.value),onBlur:p,onKeyDown:h,placeholder:u,className:`
          bg-bg-input border border-border rounded-[var(--radius-md)]
          px-2 py-1.5 outline-none focus:border-accent transition-colors
          text-text-primary text-sm
          ${n?"min-h-[80px] resize-y w-full":""}
          ${E}
        `,rows:n?3:void 0})}return b.jsx(m,{onClick:()=>{x||(r(e),f(!0))},className:`
        block max-w-full min-w-0 align-top rounded-[var(--radius-md)] px-1 -mx-1 border border-transparent
        ${x?"cursor-default":"cursor-pointer hover:border-border/50 hover:bg-bg-hover"} transition-colors duration-150
        ${e?"":"text-text-muted italic"}
        ${g}
      `,title:"Click to edit",children:d!==void 0?d:e||u})}export{w as E};
