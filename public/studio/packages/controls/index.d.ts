export function escapeHTML(value:unknown):string;
export class CommandRegistry{commands:Map<string,{id:string;label:string;run:()=>unknown;shortcut:string}>;register(id:string,label:string,run:()=>unknown,shortcut?:string):()=>void;execute(id:string):unknown;search(query?:string):{id:string;label:string;run:()=>unknown;shortcut:string}[]}
export class PanelResizer{constructor(handle:HTMLElement,target:HTMLElement,axis?:'x'|'y',min?:number,max?:number);dispose():void}
export function download(data:Blob|string|ArrayBuffer,name:string,type?:string):void;
export function debounce<T extends(...args:any[])=>any>(fn:T,ms?:number):T&{cancel():void};
export class AstrumNumber extends HTMLElement{value:number}
