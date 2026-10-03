import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync, readFileSync, writeFileSync, statSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createSessionAuth} from "../lib/auth.js";

function fixture(){
  const storeFile=join(mkdtempSync(join(tmpdir(),"supervisor-users-")),"users.json");
  return {storeFile, auth:createSessionAuth({storeFile,username:"owner",password:"bootstrap-pass",technicianUsername:"tech",technicianPassword:"tech-pass"})};
}
test("persistent store migrates existing accounts once and contains only password hashes",()=>{
  const {storeFile,auth}=fixture();
  assert.equal(auth.login("owner","bootstrap-pass").session.role,"super-admin");
  assert.equal(statSync(storeFile).mode & 0o777,0o600);
  assert.ok(!readFileSync(storeFile,"utf8").includes("bootstrap-pass"));
  const restarted=createSessionAuth({storeFile,username:"unexpected",password:"unexpected-pass"});
  assert.ok(restarted.login("owner","bootstrap-pass"));
  assert.equal(restarted.login("unexpected","unexpected-pass"),null);
  assert.equal(auth.listUsers().some(u=>"hash" in u||"password" in u),false);
});
test("account creation, disabling, reset and role changes persist and revoke sessions",()=>{
  const {auth,storeFile}=fixture();
  auth.saveUser({username:"operator",role:"technician",password:"temporary-pass"},{create:true,actor:"owner"});
  const token=auth.login("operator","temporary-pass").token;
  auth.saveUser({username:"operator",disabled:true},{actor:"owner"});
  assert.equal(auth.authenticate(auth.cookie(token)).authenticated,false);
  assert.equal(auth.login("operator","temporary-pass"),null);
  auth.saveUser({username:"operator",disabled:false,role:"viewer",password:"new-temporary-pass"},{actor:"owner"});
  assert.equal(auth.login("operator","temporary-pass"),null);
  assert.equal(auth.login("operator","new-temporary-pass").session.actionsEnabled,false);
  assert.equal(createSessionAuth({storeFile}).login("operator","new-temporary-pass").session.role,"viewer");
});
test("last super-admin, self demotion, duplicate users and invalid input are rejected",()=>{
  const {auth}=fixture();
  assert.throws(()=>auth.saveUser({username:"owner",disabled:true},{actor:"other"}),/last_super_admin/);
  assert.throws(()=>auth.saveUser({username:"owner",role:"admin"},{actor:"owner"}),/cannot_demote_self/);
  assert.throws(()=>auth.saveUser({username:"owner",role:"technician",password:"temporary-pass"},{create:true}),/user_exists/);
  assert.throws(()=>auth.saveUser({username:"bad name",role:"viewer",password:"temporary-pass"},{create:true}),/invalid_username/);
  assert.throws(()=>auth.saveUser({username:"new",role:"viewer",password:"short"},{create:true}),/password_length/);
  assert.throws(()=>auth.saveUser({username:"tech",disabled:"false"}),/invalid_status/);
});
test("corrupted store fails closed instead of reseeding environment credentials",()=>{
  const {storeFile}=fixture();
  writeFileSync(storeFile,'{}');
  assert.throws(()=>createSessionAuth({storeFile,username:"owner",password:"bootstrap-pass"}),/invalid_user_store/);
});
