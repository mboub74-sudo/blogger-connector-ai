import {randomBytes,createHmac,timingSafeEqual} from 'node:crypto';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 const {CONNECTOR_API_KEY:key,GOOGLE_CLIENT_ID:client,GOOGLE_CLIENT_SECRET:secret,GOOGLE_REDIRECT_URI:redirect}=process.env;
 if(!key||!client||!secret||!redirect)return res.status(503).send('Configure environment variables first.');
 const sign=s=>createHmac('sha256',key).update(s).digest('hex');
 const equal=(a,b)=>typeof a==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
 if(req.method==='POST'){
 if(!equal(req.body?.key,key))return res.status(401).send('Unauthorized');
 const nonce=randomBytes(32).toString('hex');
 const state=nonce+'.'+Date.now();
 res.setHeader('Set-Cookie','blogger_state='+state+'.'+sign(state)+'; HttpOnly; Secure; SameSite=Lax; Path=/api/oauth; Max-Age=600');
 return res.redirect(303,'https://accounts.google.com/o/oauth2/v2/auth?'+new URLSearchParams({client_id:client,redirect_uri:redirect,response_type:'code',scope:'https://www.googleapis.com/auth/blogger',access_type:'offline',prompt:'consent',state}));
 }
 if(req.query.code){
 const state=String(req.query.state||'');
 const cookie=(req.headers.cookie||'').split('; ').find(x=>x.startsWith('blogger_state='))?.slice(14);
 if(!equal(cookie,state+'.'+sign(state))||Math.abs(Date.now()-Number(state.split('.')[1]))>600000)return res.status(403).send('Invalid state');
 res.setHeader('Set-Cookie','blogger_state=; HttpOnly; Secure; SameSite=Lax; Path=/api/oauth; Max-Age=0');
 const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({client_id:client,client_secret:secret,redirect_uri:redirect,code:String(req.query.code),grant_type:'authorization_code'})});
 const t=await r.json();
 if(!r.ok||!t.refresh_token)return res.status(400).send('Authorization failed or no refresh token.');
 res.setHeader('Content-Type','text/plain; charset=utf-8');
 return res.send('Copy this refresh token directly into Vercel GOOGLE_REFRESH_TOKEN. Never share it in chat.\n'+t.refresh_token);
 }
 res.setHeader('Content-Type','text/html; charset=utf-8');
 return res.send('<h1>Blogger authorization</h1><form method="post"><label>Connector API key <input type="password" name="key" required></label><button>Connect Google</button></form>');
}
