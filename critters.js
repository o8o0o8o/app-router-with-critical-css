const Critters = require("critters");
const { join } = require("path");
const fs = require("fs");
const { parse } = require("node-html-parser");

function getFiles(dir, files = []) {
  const fileList = fs.readdirSync(dir);

  for (const file of fileList) {
    const name = `${dir}/${file}`;

    if (fs.statSync(name).isDirectory()) {
      getFiles(name, files);
    } else {
      files.push(name);
    }
  }
  return files;
}

async function processHTMLFile(file, htmlString, runtime) {
  try {
    const critters = new Critters();
    const html = htmlString || (file && fs.readFileSync(file, "utf-8"));

    const pathPatterns = {
      real: "/.next/static/css",
      original: "/_next/static/css",
    };

    const changedToRealPath = html.replaceAll(
      pathPatterns.original,
      pathPatterns.real
    );

    const inlined = await critters.process(changedToRealPath);

    const restoredNextJSPath = inlined.replaceAll(
      pathPatterns.real,
      pathPatterns.original
    );

    const DOMAfterCritters = parse(restoredNextJSPath);
    const head = DOMAfterCritters.querySelector("head");

    if (head) {
      for (const linkInHead of head.querySelectorAll("link")) {
        if (
          linkInHead.attributes?.as === "style" ||
          linkInHead.attributes?.rel === "stylesheet"
        ) {
          linkInHead.remove();
        }
      }
    }

    // save HTML file in runtime, only for ISR https://nextjs.org/docs/pages/building-your-application/data-fetching/incremental-static-regeneration
    if (runtime === "ISR") {
      const filePath = join(
        process.cwd(),
        ".next",
        "server",
        "pages",
        file + ".html"
      );

      fs.writeFile(filePath, DOMAfterCritters.toString(), (err) => {
        if (err) {
          console.error("Error saving the HTML file:", err);
        } else {
          console.log("The HTML file has been saved: ", filePath);
        }
      });
      // we don't save file in SSR
    } else if (runtime !== "SSR") {
      fs.writeFileSync(file, DOMAfterCritters.toString());
    }

    const inlinedStyles = DOMAfterCritters.querySelector("style");

    return inlinedStyles.text;
  } catch (error) {}
}

async function main() {
  const currentFolder = join(process.cwd(), ".next");
  const files = getFiles(currentFolder);
  const processedRoutes = [];

  for (const file of files) {
    if (file.endsWith(".html")) {
      const pagesFolder = file.split(".next/server/pages")[1];

      if (pagesFolder) {
        await processHTMLFile(file, pagesFolder);

        processedRoutes.push(
          pagesFolder.replace(".html", "").replace("index", "")
        );
      }

      const appFolder = file.split(".next/server/app")[1];

      if (appFolder) {
        await processHTMLFile(file, appFolder);

        processedRoutes.push(
          appFolder.replace(".html", "").replace("index", "")
        );
      }
    }
  }

  fs.writeFileSync(
    join(process.cwd(), "processedRoutes.json"),
    JSON.stringify(processedRoutes)
  );
}

module.exports = { processHTMLFile };

if (process.env.CRITTERS_BUILD) {
  console.time("Critters: build job");
  main();
  console.timeEnd("Critters: build job");
}
