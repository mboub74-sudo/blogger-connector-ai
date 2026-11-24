import { timingSafeEqual } from 'node:crypto';
export default async function handler(req,res) {
 const key=process.env.CONNECTOR_API_KEY;
 const auth=req.headers.authorization||'';
 const expected='Bearer '+key;
 if(!key||Buffer.byteLength(auth)!==Buffer.byteLength(expected)||!timingSafeEqual(Buffer.from(auth),Buffer.from(expected))) return res.status(401).json({error:'Unauthorized'});
 if(req.method!=='POST') return res.status(405).end();
 try {
 const {action,blogId,postId,title,content,labels}=req.body||{};
 const id=x=>typeof x==='string'&&/^\d+$/.test(x);
 if(action!=='list_blogs'&&!id(blogId)) return res.status(400).json({error:'Invalid blog ID'});
 const tokenResponse=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID,client_secret:process.env.GOOGLE_CLIENT_SECRET,refresh_token:process.env.GOOGLE_REFRESH_TOKEN,grant_type:'refresh_token'})});
 const token=await tokenResponse.json();
 if(!tokenResponse.ok) return res.status(502).json({error:'Google authorization failed'});
 let path,method='GET',body;
 switch(action){
 case 'list_blogs':path='/users/self/blogs';break;
 case 'list_posts':path='/blogs/'+blogId+'/posts?view=ADMIN';break;
 case 'get_post':case 'update_post':case 'publish_post':
 if(!id(postId))return res.status(400).json({error:'Invalid post ID'});
 path='/blogs/'+blogId+'/posts/'+postId;
 if(action==='update_post'){method='PATCH';body={title,content,labels};}
 if(action==='publish_post'){method='POST';path+='/publish';}
 break;
 case 'create_post':path='/blogs/'+blogId+'/posts?isDraft=true';method='POST';body={title,content,labels};break;
 default:return res.status(400).json({error:'Unknown action'});
 }
 const response=await fetch('https://www.googleapis.com/blogger/v3'+path,{method,headers:{Authorization:'Bearer '+token.access_token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 return res.status(response.status).json(await response.json());
 }catch{return res.status(500).json({error:'Connector request failed'});}
}
