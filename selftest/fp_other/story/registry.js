/* fingerprint.js 的对照夹具：结构和 good 不同（3 个数值、4 个结局、不同曲目），只给 fingerprint 读 */
(function (root) {
  const R = {};
  R.TITLE = { name: "指纹对照", sub: "", scene: "p" };
  R.SCENES = { p: "占位" };
  R.VARS = { x: { name: "X", init: 0 }, y: { name: "Y", init: 0 }, z: { name: "Z", init: 0 } };
  R.BGM = ["none", "alpha", "beta"];
  R.ENDINGS = { E1: { name: "一" }, E2: { name: "二" }, E3: { name: "三" }, E4: { name: "四" } };
  R.CHAPTERS = { ch1: { title: "对照" } };
  R.FLOW = ["ch1"];
  if (typeof module !== "undefined" && module.exports) module.exports = R; else root.REG = R;
})(typeof window !== "undefined" ? window : globalThis);
