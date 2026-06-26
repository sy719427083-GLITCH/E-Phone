import test from "node:test";
import assert from "node:assert/strict";

import { getHomeAppPages } from "../lib/homeApps.js";

test("splits home apps into a twelve-icon first page and a second page for new apps", () => {
  const pages = getHomeAppPages();

  assert.equal(pages.length, 2);
  assert.equal(pages[0].length, 12);
  assert.deepEqual(
    pages[1].map((item) => item.label),
    ["工作", "平行时空", "查手机", "微博", "日程", "特别活动", "经营"],
  );
});
