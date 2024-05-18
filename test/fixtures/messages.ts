import { CRYPTO_SPLIT_CHAR } from "src/utils";

export const rawFixture = { hello: "world", lorem: { ipsum: null, dolor: false, sit: 100, amet: 10000 } };

export const hmacFixture = `eyJoZWxsbyI6IndvcmxkIiwibG9yZW0iOnsiaXBzdW0iOm51bGwsImRvbG9yIjpmYWxzZSwic2l0IjoxMDAsImFtZXQiOjEwMDAwfX0=${CRYPTO_SPLIT_CHAR}RviejHnjBZSSUbMGZQACABUHIzabmk0jb+yv/Zv/yj8`;

export const sodiumAuthFixture = `eyJoZWxsbyI6IndvcmxkIiwibG9yZW0iOnsiaXBzdW0iOm51bGwsImRvbG9yIjpmYWxzZSwic2l0IjoxMDAsImFtZXQiOjEwMDAwfX0=${CRYPTO_SPLIT_CHAR}3CJqesQxEydzbYfd2d7PDvz88pSkt/dUVbVPuF3eHcw=`;

export const sodiumSecretboxFixture = `ljXswa0IDwp11YVWDETO3Q5a1SzO7nMirizSDnB3mWD/+iUu3CcWRtHRL36jN3+HpFuqRkpv1yIHzXaWIwYlOPSDSWeXR5B9ee0yPObcTO2njBfHterZ1yJ1penI${CRYPTO_SPLIT_CHAR}yNikgCVQWK7IudZfy5ijcrb/iGsCefcx`;

export const sodiumSecretboxFixtureMsgpack = `OIEU0E6GDcl6vu9Q+GkE5r7UicYri2aMd+haodQbqRd3UjYZi150DoPa8N8L3Wdf1j0CfW1rI5vJ+gzN5Ekooqk6Lw==${CRYPTO_SPLIT_CHAR}iwgm3snCPcP62q1O6fLoP18FPWCA7G/D`;
