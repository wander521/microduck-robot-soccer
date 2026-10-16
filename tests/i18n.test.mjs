import test from "node:test";
import assert from "node:assert/strict";
import { chooseLanguage, setLanguage, t, runtimeMessage } from "../src/i18n.js";

test("language choice respects shared URLs, saved preferences, browser locales and unsupported input", () => {
  assert.equal(chooseLanguage({ query: "en", stored: "zh-CN", browser: "zh-TW" }), "en");
  assert.equal(chooseLanguage({ query: "xx", stored: "zh-CN", browser: "en-US" }), "zh-CN");
  assert.equal(chooseLanguage({ browser: "zh-Hant" }), "zh-CN");
  assert.equal(chooseLanguage({ browser: "en-GB" }), "en");
  assert.equal(chooseLanguage({ query: "javascript:alert(1)", browser: "fr-FR" }), "en");
});

test("live status, cooldowns and training move names can switch both ways without changing their values", () => {
  setLanguage("en");
  assert.equal(t("冲撞冷却，剩余 {seconds} 秒", { seconds: 7 }), "Charge cooldown: 7 seconds left");
  assert.equal(t("正在集合 · {ready}/{total} 就位", { ready: 3, total: 4 }), "Lining up · 3/4 ready");
  assert.equal(t("嘎嘎齐舞"), "Quack together");
  assert.equal(t("My 鸭"), "My 鸭");
  setLanguage("zh-CN");
  assert.equal(t("冲撞冷却，剩余 {seconds} 秒", { seconds: 7 }), "冲撞冷却，剩余 7 秒");
  assert.equal(t("正在集合 · {ready}/{total} 就位", { ready: 3, total: 4 }), "正在集合 · 3/4 就位");
});

test("runtime errors preserve their HTTP status and asset path in either language", () => {
  setLanguage("en");
  assert.equal(runtimeMessage("资源加载失败 (404): robot/test.xml"), "Asset loading failed (404): robot/test.xml");
  assert.equal(runtimeMessage("足球策略与当前运行时契约不兼容"), "The soccer policy is incompatible with this runtime");
  setLanguage("zh-CN");
  assert.equal(runtimeMessage("资源加载失败 (404): robot/test.xml"), "资源加载失败 (404)：robot/test.xml");
});
