import {createHash} from 'node:crypto';
import {readdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=dirname(dirname(fileURLToPath(import.meta.url)));
async function files(path){
 const entries=await readdir(path,{withFileTypes:true});
 return(await Promise.all(entries.sort((a,b)=>a.name.localeCompare(b.name,'en')).map(entry=>entry.isDirectory()?files(join(path,entry.name)):entry.isFile()?[join(path,entry.name)]:[]))).flat();
}
const inputs=[...(await files(join(root,'src'))),...(await files(join(root,'public'))),...['scripts/write-build-info.mjs','scripts/prerender.mjs','index.html','package.json','package-lock.json','tsconfig.json'].map(p=>join(root,p))].sort();
const hash=createHash('sha256');
for(const path of inputs){hash.update(relative(root,path).split('\\').join('/')+'\0');hash.update(await readFile(path));hash.update('\0');}
const sourceSha256=hash.digest('hex');
const info={schemaVersion:1,sourceId:sourceSha256.slice(0,12),sourceSha256,sourceFileCount:inputs.length,builtAt:new Date().toISOString(),commit:process.env.GITHUB_SHA??null};
await writeFile(join(root,'dist/build-info.json'),JSON.stringify(info,null,2)+'\n');
console.log(`Game source version: ${info.sourceId}`);
