import test from "node:test";
import assert from "node:assert/strict";
import {base32Encode,totp,verifyTotp} from "../lib/totp.js";

test("TOTP matches all RFC 6238 SHA1 test vectors",()=>{
  const secret=base32Encode(Buffer.from("12345678901234567890"));
  for(const [time,code] of [[59,"94287082"],[1111111109,"07081804"],[1111111111,"14050471"],[1234567890,"89005924"],[2000000000,"69279037"],[20000000000,"65353130"]]) {
    assert.equal(totp(secret,{time:time*1000,digits:8}),code);
  }
});
test("TOTP accepts only six digits within one step and refuses replay",()=>{
  const secret=base32Encode(Buffer.from("12345678901234567890")),time=1234567890000;
  const counter=Math.floor(time/30000);
  const code=totp(secret,{time});
  assert.equal(verifyTotp(secret,code,{time}),counter);
  assert.equal(verifyTotp(secret,code,{time,lastCounter:counter}),null);
  assert.equal(verifyTotp(secret,totp(secret,{time:time-30000}),{time}),counter-1);
  assert.equal(verifyTotp(secret,totp(secret,{time:time+60000}),{time}),null);
  assert.equal(verifyTotp(secret,"abcdef",{time}),null);
});
