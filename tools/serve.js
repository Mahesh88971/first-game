import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname} from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const files=new Set(['/','/index.html','/styles.css','/build/wildline.js','/assets/storm-coast.webp','/assets/garage.webp']);
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.webp':'image/webp'};
const port=Number(process.env.PORT)||4173;
const server=createServer(async(req,res)=>{
  const path=(req.url||'/').split('?')[0];
  if(req.method!=='GET'||!files.has(path)){res.writeHead(404);res.end();return;}
  const file=resolve(root,'.'+(path==='/'?'/index.html':path));
  try{
    const body=await readFile(file);
    res.writeHead(200,{'Content-Type':mime[extname(file)],'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(body);
  }catch{res.writeHead(404);res.end();}
});
server.on('error',err=>{console.error('Local server:',err.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log('Wildline Racing is available at http://127.0.0.1:'+port));
