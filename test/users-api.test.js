import {totp} from "../lib/totp.js";
import test from "node:test";
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {mkdtempSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";

test("user administration API enforces roles, action header and password confirmation", async t=>{
  const dir=mkdtempSync(join(tmpdir(),"supervisor-api-"));
  const proc=spawn(process.execPath,["server.js"],{env:{...process.env,HOST:"127.0.0.1",PORT:"0",DEMO_MODE:"true",NODE_ENV:"test",USERS_FILE:join(dir,"users.json"),SUPERVISOR_USERNAME:"owner",SUPERVISOR_PASSWORD:"bootstrap-pass",SUPERVISOR_TECH_USERNAME:"tech",SUPERVISOR_TECH_PASSWORD:"tech-pass",EVENTS_FILE:join(dir,"events.jsonl"),INCIDENT_STATE_FILE:join(dir,"incidents.json"),WATCHDOG_STATE_FILE:join(dir,"watchdog.json")},stdio:["ignore","pipe","pipe"]});
  t.after(()=>proc.kill());
  // Startup log includes the actual listening port.
  let output="";
  const base=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('startup timeout: '+output)),5000);
    proc.stdout.on('data',chunk=>{output+=chunk;const match=output.match(/127\.0\.0\.1:(\d+)/);if(match){clearTimeout(timer);resolve("http://"+match[0]);}});
    proc.on('exit',()=>{clearTimeout(timer);reject(new Error('server exited'));});
  });
  async function login(username,password){
    const res=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});
    assert.equal(res.status,200);return res.headers.get('set-cookie').split(';')[0];
  }
  const owner=await login('owner','bootstrap-pass'),tech=await login('tech','tech-pass');
  assert.equal((await fetch(base+'/api/admin/users')).status,401);
  assert.equal((await fetch(base+'/api/admin/users',{headers:{Cookie:tech}})).status,403);
  const body={username:'operator',role:'technician',password:'temporary-pass',confirmPassword:'temporary-pass'};
  const write=(cookie,method='POST',data=body,action=true)=>fetch(base+'/api/admin/users',{method,headers:{Cookie:cookie,'Content-Type':'application/json',...(action?{'X-Supervisor-Action':'1'}:{})},body:JSON.stringify(data)});
  assert.equal((await write(tech)).status,403);
  assert.equal((await write(owner,'POST',body,false)).status,403);
  assert.equal((await write(owner,'POST',{...body,confirmPassword:'different'})).status,400);
  assert.equal((await write(owner)).status,201);
  const operator=await login('operator','temporary-pass');
  assert.equal((await write(owner,'PATCH',{username:'operator',disabled:true})).status,200);
  assert.equal((await fetch(base+'/api/session',{headers:{Cookie:operator}})).status,200);
  assert.equal((await (await fetch(base+'/api/session',{headers:{Cookie:operator}})).json()).authenticated,false);
  const listed=await (await fetch(base+'/api/admin/users',{headers:{Cookie:owner}})).json();
  assert.ok(!JSON.stringify(listed).includes('temporary-pass'));
  assert.ok(!JSON.stringify(listed).includes('"hash"'));
  assert.equal((await write(owner,'DELETE',{username:'operator'})).status,400);
  assert.equal((await write(tech,'DELETE',{username:'operator',confirmUsername:'operator'})).status,403);
  assert.equal((await write(owner,'DELETE',{username:'operator',confirmUsername:'operator'})).status,200);
  assert.equal((await write(owner,'DELETE',{username:'owner',confirmUsername:'owner'})).status,400);
  const security=(action,data)=>fetch(base+'/api/account/2fa/'+action,{method:'POST',headers:{Cookie:owner,'Content-Type':'application/json','X-Supervisor-Action':'1'},body:JSON.stringify(data)});
  const setup=await (await security('setup',{password:'bootstrap-pass'})).json();
  assert.match(setup.qrDataUrl,/^data:image\/png;base64,/);
  const codes=await (await security('confirm',{password:'bootstrap-pass',token:totp(setup.secret)})).json();
  assert.equal(codes.recoveryCodes.length,10);
  const challenge=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'owner',password:'bootstrap-pass'})});
  assert.equal(challenge.status,401);assert.equal(challenge.headers.get('set-cookie'),null);
  assert.equal((await challenge.json()).code,'two_factor_required');
  const restored=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'owner',password:'bootstrap-pass',token:codes.recoveryCodes[0]})});
  assert.equal(restored.status,200);
  const replay=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'owner',password:'bootstrap-pass',token:codes.recoveryCodes[0]})});
  assert.equal(replay.status,401);
});
