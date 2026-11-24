import {timingSafeEqual} from 'node:crypto';
import blogger from './blogger.js';
const id={type:'string',pattern:'^[0-9]+$'};
const str={type:'string'};
const labels={type:'array',items:str};
const tools=[
{name:'list_blogs',description:'List authorized Blogger blogs',inputSchema:{type:'object',properties:{},additionalProperties:false}},
{name:'list_posts',description:'List posts in a blog',inputSchema:{type:'object',properties:{blogId:id},required:['blogId'],additionalProperties:false}},
{name:'get_post',description:'Read a post',inputSchema:{type:'object',properties:{blogId:id,postId:id},required:['blogId','postId'],additionalProperties:false}},
{name:'create_post',description:'Create a private draft only; never publishes',inputSchema:{type:'object',properties:{blogId:id,title:str,content:str,labels},required:['blogId','title','content'],additionalProperties:false}}
];
export default async function handler(req,res){
res.setHeader('Cache-Control','no-store');
const key=process.env.CONNECTOR_API_KEY;
const auth=req.headers.authorization||'';
const expected='Bearer '+key;
if(!key||Buffer.byteLength(auth)!==Buffer.byteLength(expected)||!timingSafeEqual(Buffer.from(auth),Buffer.from(expected)))return res.status(401).json({error:'Unauthorized'});
if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).end();}
const origin=req.headers.origin;
if(origin&&origin!=='https://chatgpt.com'&&origin!=='https://chat.openai.com')return res.status(403).end();
const q=req.body;
if(!q||q.jsonrpc!=='2.0'||typeof q.method!=='string')return res.status(400).json({jsonrpc:'2.0',id:null,error:{code:-32600,message:'Invalid Request'}});
const reply=result=>res.json({jsonrpc:'2.0',id:q.id??null,result});
const fail=(code,message)=>res.json({jsonrpc:'2.0',id:q.id??null,error:{code,message}});
if(q.method.startsWith('notifications/'))return res.status(202).end();
if(q.method==='initialize')return reply({protocolVersion:['2025-03-26','2025-06-18','2025-11-25'].includes(q.params?.protocolVersion)?q.params.protocolVersion:'2025-03-26',capabilities:{tools:{}},serverInfo:{name:'blogger-connector-ai',version:'0.1.0'}});
if(q.method==='ping')return reply({});
if(q.method==='tools/list')return reply({tools});
if(q.method!=='tools/call')return fail(-32601,'Method not found');
const tool=tools.find(t=>t.name===q.params?.name);
const a=q.params?.arguments||{};
if(!tool||typeof a!=='object'||Array.isArray(a))return fail(-32602,'Invalid tool');
for(const k of Object.keys(a))if(!Object.hasOwn(tool.inputSchema.properties,k))return fail(-32602,'Unknown argument');
for(const k of tool.inputSchema.required||[])if(typeof a[k]!=='string'||!a[k].trim())return fail(-32602,'Missing argument');
if(a.labels!==undefined&&(!Array.isArray(a.labels)||a.labels.some(x=>typeof x!=='string')))return fail(-32602,'Invalid labels');
let status=200;
const adapter={status(n){status=n;return this;},json(data){return reply({content:[{type:'text',text:JSON.stringify(data)}],isError:status>=400});},end(){return fail(-32603,'Connector failed');}};
return blogger({method:'POST',headers:req.headers,body:{...a,action:tool.name}},adapter);
}
