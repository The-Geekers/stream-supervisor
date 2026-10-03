import { createHmac, timingSafeEqual } from "node:crypto";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function base32Encode(bytes) {
  let bits=0, value=0, output="";
  for (const byte of bytes) {
    value=(value<<8)|byte; bits+=8;
    while(bits>=5){output+=alphabet[(value>>>(bits-5))&31];bits-=5;}
  }
  if(bits)output+=alphabet[(value<<(5-bits))&31];
  return output;
}
function decode(secret) {
  if(typeof secret!=="string"||!/^[A-Z2-7]+$/.test(secret))throw new Error("invalid_totp_secret");
  let bits=0,value=0;const bytes=[];
  for(const char of secret){value=(value<<5)|alphabet.indexOf(char);bits+=5;if(bits>=8){bytes.push((value>>>(bits-8))&255);bits-=8;}}
  return Buffer.from(bytes);
}
export function totp(secret, {time=Date.now(), digits=6}={}) {
  const counter=Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(time/30000)));
  const mac=createHmac("sha1",decode(secret)).update(counter).digest();
  const offset=mac[mac.length-1]&15;
  return String((mac.readUInt32BE(offset)&0x7fffffff)%(10**digits)).padStart(digits,"0");
}
export function verifyTotp(secret, token, {time=Date.now(), lastCounter=-1}={}) {
  if(typeof token!=="string"||!/^\d{6}$/.test(token))return null;
  const current=Math.floor(time/30000);
  for(const counter of [current,current-1,current+1]) {
    if(counter<=lastCounter||counter<0)continue;
    if(timingSafeEqual(Buffer.from(token),Buffer.from(totp(secret,{time:counter*30000}))))return counter;
  }
  return null;
}
