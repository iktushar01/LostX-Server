import fs from "fs";
import path from "path";

const assets = [
  {
    source: path.join("src", "app", "templates"),
    target: path.join("dist", "app", "templates"),
  },
];

for (const { source, target } of assets) {
  if (!fs.existsSync(source)) {
    continue;
  }

  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true });

  console.log(`Copied assets from ${source} to ${target}`);
}
