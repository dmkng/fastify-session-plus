import { SODIUM_SECRETBOX } from "@mgcrea/fastify-session-sodium-crypto";
import benchmark from "benchmark";
import { pack } from "msgpackr";
import { rawFixture, secretKey } from "test/fixtures";

const { Suite } = benchmark;

new Suite()
  .add("SODIUM_SECRETBOX#serializeMsgpack", function () {
    SODIUM_SECRETBOX.sealMessage(pack(rawFixture), secretKey);
  })
  .add("SODIUM_SECRETBOX#serializeJson", function () {
    SODIUM_SECRETBOX.sealMessage(Buffer.from(JSON.stringify(rawFixture)), secretKey);
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
