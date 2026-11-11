const test=require('node:test');
const assert=require('node:assert/strict');
const filesystem=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function identity(project){
  const window={PortfolioHub:{navProject:()=>project},ProjectStudio:{coordinatorName:()=>project?.workspace?.profile?.name||'连小山'}};
  vm.runInNewContext(filesystem.readFileSync(path.join(__dirname,'../app/identity.js'),'utf8'),{window,document:{addEventListener(){}}});
  return window.HubIdentity;
}

test('coordinator uses one self-contained mountain mascot at every existing avatar size',()=>{
  const avatars=identity();
  for(const size of ['xs','sm','md','lg','xl']){
    const markup=avatars.worker('manager',size);
    assert.match(markup,new RegExp('identity-size-'+size));
    assert.match(markup,/data-mascot="lianxiaoshan"/);
    assert.match(markup,/viewBox="0 0 64 64"/);
    assert.match(markup,/aria-label="连小山 · 协调助手"/);
    assert.match(markup,/aria-hidden="true" focusable="false"/);
    assert.doesNotMatch(markup,/<(?:image|script|foreignObject|text)\b|\bhref=|\bon\w+=|<animate|<filter/);
    assert.equal((markup.match(/<svg\b/g)||[]).length,1);
  }
});

test('other assistant identities and user-selected avatar versions are not replaced',()=>{
  const project={workspace:{profile:{name:'连小山'},agents:[{id:'custom-1',name:'业务助手',activeVersion:'V1',avatar:{art:'service',tone:'teal'},releases:[{version:'V1',config:{avatar:{art:'ticket',tone:'blue'}}}]}]}};
  const before=JSON.stringify(project);const avatars=identity(project);
  for(const worker of ['service','ticket','quality','knowledge','analytics','expert','unknown'])assert.doesNotMatch(avatars.worker(worker),/data-mascot="lianxiaoshan"/);
  assert.doesNotMatch(avatars.assistant({name:'自选头像',avatar:{art:'manager',tone:'clay'}}),/data-mascot="lianxiaoshan"/);
  const custom=avatars.worker('custom-1');assert.match(custom,/data-tone="blue"/);assert.match(custom,/业务办理头像/);assert.doesNotMatch(custom,/data-mascot="lianxiaoshan"/);assert.equal(JSON.stringify(project),before);
});

test('the mascot retains an escaped personalized accessible name without modifying project records',()=>{
  const project={workspace:{profile:{name:'值班<助手>'},agents:[],messages:{group:[{author:'manager',text:'原始记录'}]},tasks:[{id:'old-task'}]}};
  const before=JSON.stringify(project);const markup=identity(project).worker('manager');
  assert.match(markup,/aria-label="值班&lt;助手&gt; · 协调助手"/);assert.match(markup,/data-mascot="lianxiaoshan"/);assert.equal(JSON.stringify(project),before);
});
