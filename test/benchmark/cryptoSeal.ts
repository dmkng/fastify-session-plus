import { SODIUM_AUTH, SODIUM_SECRETBOX } from "@mgcrea/fastify-session-sodium-crypto";
import benchmark from "benchmark";
import { pack } from "msgpackr";
import { HMAC } from "src";
import { rawFixture, secretKey } from "test/fixtures";

const { Suite } = benchmark;

const message = Buffer.from(JSON.stringify(rawFixture));
const msgpackMessage = pack(rawFixture);

new Suite()
  .add("SODIUM_SECRETBOX#sealMsgpack", function () {
    SODIUM_SECRETBOX.sealMessage(msgpackMessage, secretKey);
  })
  .add("SODIUM_SECRETBOX#sealJson", function () {
    SODIUM_SECRETBOX.sealMessage(message, secretKey);
  })
  .add("SODIUM_AUTH#sealJson", function () {
    SODIUM_AUTH.sealMessage(message, secretKey);
  })
  .add("HMAC#sealJson", function () {
    HMAC.sealMessage(message, secretKey);
  })
  // add listeners
  .on("cycle", function (event: Event) {
    console.log(String(event.target));
  })
  .on("complete", function () {
    // @ts-expect-error this
    console.log("Fastest is " + this.filter("fastest").map("name"));
  })
  // run async
  .run({ async: true });
