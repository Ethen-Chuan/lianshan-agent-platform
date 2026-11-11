const {DatabaseSync}=require('node:sqlite');
const fs=require('node:fs');
const path=require('node:path');

function createTaskStore(filename=':memory:'){
  if(filename!==':memory:')fs.mkdirSync(path.dirname(filename),{recursive:true,mode:0o700});
  const database=new DatabaseSync(filename);
  if(filename!==':memory:')fs.chmodSync(filename,0o600);
  database.exec('PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS runtime (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, payload TEXT NOT NULL) STRICT;');
  const empty={schema:1,revision:0,concurrency:3,tasks:[],events:[]};
  database.prepare('INSERT OR IGNORE INTO runtime (id,revision,payload) VALUES (1,0,?)').run(JSON.stringify(empty));
  function read(){
    const value=JSON.parse(database.prepare('SELECT payload FROM runtime WHERE id=1').get().payload);
    if(value.schema!==1)throw new Error('任务数据库版本不兼容，请保留原文件并升级服务。');
    return value;
  }
  function write(value,expectedRevision){
    const next={...value,revision:expectedRevision+1};
    const result=database.prepare('UPDATE runtime SET revision=?,payload=? WHERE id=1 AND revision=?').run(next.revision,JSON.stringify(next),expectedRevision);
    if(result.changes!==1)throw Object.assign(new Error('任务记录已被另一个服务更新，请只保留一个运行服务。'),{status:409});
    return next;
  }
  return {read,write,close:()=>database.close()};
}
module.exports={createTaskStore};
