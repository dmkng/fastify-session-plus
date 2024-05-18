import { SODIUM_SECRETBOX } from "@mgcrea/fastify-session-sodium-crypto";
import benchmark from "benchmark";
import { unpack } from "msgpackr";
import { secretKey, sodiumSecretboxFixture, sodiumSecretboxFixtureMsgpack } from "test/fixtures";

const { Suite } = benchmark;

new Suite()
  .add("SODIUM_SECRETBOX#deserializeMsgpack", function () {
    unpack(SODIUM_SECRETBOX.unsealMessage(sodiumSecretboxFixtureMsgpack, [secretKey]).buffer);
  })
  .add("SODIUM_SECRETBOX#deserializeJson", function () {
    JSON.parse(SODIUM_SECRETBOX.unsealMessage(sodiumSecretboxFixture, [secretKey]).buffer.toString());
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
