import { spawnSync } from "child_process";
import fs from "fs";

const proc = spawnSync("npm", ["audit", "--json"], {
  encoding: "buffer",
  shell: true,
});
const raw = proc.stdout?.length ? proc.stdout : proc.stderr;
let text = raw.toString("utf8");
if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
if (text.includes("\u0000")) {
  text = raw.toString("utf16le").replace(/^\uFEFF/, "");
}
const j = JSON.parse(text);
const vulns = j.vulnerabilities || {};
const focus = {};
for (const [name, v] of Object.entries(vulns)) {
  if (/glob|uuid|exceljs|opennext|minimatch|@node-minify/i.test(name)) {
    focus[name] = {
      severity: v.severity,
      range: v.range,
      isDirect: v.isDirect,
      fixAvailable: v.fixAvailable,
      via: (v.via || [])
        .map((x) => (typeof x === "string" ? x : x.name || x.source))
        .slice(0, 8),
    };
  }
}
const out = {
  metadata: j.metadata,
  focus,
  highOrCritical: Object.entries(vulns)
    .filter(([, v]) => v.severity === "high" || v.severity === "critical")
    .map(([n, v]) => ({ name: n, severity: v.severity })),
};
fs.writeFileSync("SEC_003_AUDIT_SNIPPET.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
