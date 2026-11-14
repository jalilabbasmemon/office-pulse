import fs from "fs";

const file = ".env.qa.local";
if (!fs.existsSync(file)) {
  console.log(JSON.stringify({ exists: false }));
  process.exit(0);
}
const text = fs.readFileSync(file, "utf8");
const m = text.match(/^SUPABASE_SECRET_KEY\s*=\s*(.*)$/m);
let v = m ? m[1].trim() : "";
if (
  (v.startsWith('"') && v.endsWith('"')) ||
  (v.startsWith("'") && v.endsWith("'"))
) {
  v = v.slice(1, -1);
}
console.log(
  JSON.stringify({
    exists: true,
    secret_len: v.length,
    looks_real:
      v.length > 20 && !/placeholder|ChangeMe|^</i.test(v) && !/^<.*>$/.test(v),
    prefix: v.slice(0, 8),
  })
);
