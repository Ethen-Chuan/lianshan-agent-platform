const test=require('node:test');
const assert=require('node:assert/strict');
const filesystem=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function fixture(){
  const window={};
  const context=vm.createContext({window,document:{readyState:'loading',addEventListener(){}}});
  vm.runInContext(filesystem.readFileSync(path.join(__dirname,'../app/icon-help.js'),'utf8'),context);
  return window.HubIconHelp;
}

function control({text='',disabled=false,ariaDisabled=false,inert=false,navigation,caption=false}={}){
  return {
    closest:()=>inert?{}:null,
    matches:selector=>selector==='[disabled],[aria-disabled="true"]'&&(disabled||ariaDisabled),
    querySelector:()=>navigation===undefined?null:{getClientRects:()=>navigation?[{}]:[]},
    cloneNode(){
      const clone={textContent:text+(caption?'自动图标标签':'')};
      clone.querySelectorAll=selector=>{
        assert.equal(selector,'svg,.icon-action-caption,.sr-only,kbd');
        return caption?[{remove(){clone.textContent=text;}}]:[];
      };
      return clone;
    }
  };
}

test('clearly labelled actions and selects do not open redundant explanations',()=>{
  const help=fixture();
  for(const text of ['保存草稿','预览修改','业务本体','关联会话','']){
    assert.equal(help.needsHelp(control({text})),!text);
  }
});

test('icon-only controls keep help even after automatic captions are attached',()=>{
  const help=fixture();
  assert.equal(help.needsHelp(control()),true);
  assert.equal(help.needsHelp(control({caption:true})),true);
  assert.equal(help.needsHelp(control({text:'保存',caption:true})),false);
});

test('disabled actions retain explanations instead of becoming silent',()=>{
  const help=fixture();
  assert.equal(help.needsHelp(control({text:'加入团队',disabled:true})),true);
  assert.equal(help.needsHelp(control({text:'加入团队',ariaDisabled:true})),true);
});

test('navigation help is shown only when its label is not rendered',()=>{
  const help=fixture();
  assert.equal(help.needsHelp(control({text:'业务本体',navigation:true})),false);
  assert.equal(help.needsHelp(control({text:'业务本体',navigation:false})),true);
});

test('inert controls never open help, including disabled and icon-only controls',()=>{
  const help=fixture();
  assert.equal(help.needsHelp(null),false);
  assert.equal(help.needsHelp(control({inert:true})),false);
  assert.equal(help.needsHelp(control({disabled:true,inert:true})),false);
});
