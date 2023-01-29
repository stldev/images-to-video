import { execSync } from "node:child_process";
import path, { normalize } from "node:path";
import * as url from "url";
import {
  existsSync,
  mkdirSync,
  rmSync,
  readdirSync,
  writeFileSync as wfs,
} from "node:fs";
import videoshow from "videoshow";
import {
  srcPathImgsRoot,
  destPathImgsRoot,
  allCameras,
  emailCfg,
} from "./config.js";

console.time("finalVideoDone");

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

const execOpts = {
  // stdio: "inherit", // If uncommented then execSync does NOT return data
  encoding: "utf-8",
  shell: "powershell",
  windowsHide: true,
};

// TODO: make it loop thru all
const cameraNum = allCameras[3];

const today = new Date(new Date().setHours(12)).toISOString().split("T")[0];
// const today = "2023-01-28";

let totalPassesNeeded = 0;
let allRemaining = 0;
let allInProgress = 0;
let currentCount = 0;
let allImgPaths = [];
const bucketAmt = 300;

const srcDir = "imgs";
const destDir = "videos";
const srcPathImgs = normalize(`${srcPathImgsRoot}${cameraNum}/${today}`);
const destPathImgs = normalize(`${destPathImgsRoot}/${cameraNum}`);

function sendEmail(link, email) {
  const body = `Imgs to video done: <a href='${link}'>RickB_org</a>`;
  const creds = `-emailuser "${emailCfg.from}" -emailpass "${emailCfg.pass}"`;

  const scriptEmail = path.join(__dirname, "./send-email.ps1");
  const scriptArgs = `-emailto "${email}" -emailsubject "${emailCfg.subject}" -emailbody "${body}" ${creds}`;

  execSync(`${scriptEmail} ${scriptArgs}`, execOpts);
}

function copyImgs(camera) {
  if (existsSync(srcDir)) rmSync(srcDir, { recursive: true });
  if (!existsSync(srcDir)) mkdirSync(srcDir);
  if (!existsSync(`${srcDir}/${camera}`)) mkdirSync(`${srcDir}/${camera}`);

  const scriptPath = path.join(__dirname, "./sync.ps1");
  const scriptArgs = `-srcbase "${srcPathImgs}" -destbase "${destPathImgs}"`;

  execSync(`${scriptPath} ${scriptArgs}`, execOpts);
}

function combineAll(camera) {
  console.log("combineAll-starting...");
  const fileData = Array(totalPassesNeeded)
    .fill(0)
    .map((m, i) => `file './${camera}/${i + 1}-video.mp4'`);
  wfs(`./videos/${camera}-vidlist.txt`, fileData.join("\n"), {
    encoding: "utf-8",
  });
  // https://trac.ffmpeg.org/wiki/Concatenate
  execSync(
    `powershell -command "ffmpeg -f concat -safe 0 -i videos/${camera}-vidlist.txt -c copy videos/${camera}-all.mp4"`,
    execOpts
  );
  console.log("_____combineAll-DONE_____");
  console.timeEnd("finalVideoDone");
  sendEmail("https://rickb.org", emailCfg.admin);
}

function makeVid(camera) {
  currentCount += 1;
  allInProgress += 1;
  const group = allImgPaths.splice(0, bucketAmt);

  if (group.length < 1) return "STOP!";

  videoshow(group, {
    fps: 25,
    loop: 0.3, // seconds
    transition: false,
    // transitionDuration: 0.1, // seconds
    videoBitrate: 1024,
    videoCodec: "libx264",
    size: "640x?",
    format: "mp4",
    pixelFormat: "yuv420p",
  })
    .save(`./${destDir}/${camera}/${currentCount}-video.mp4`)
    .on("start", (cmd) =>
      console.log(
        `ffmpeg_started | camera: ${camera} | allRemaining: ${allRemaining}`
      )
    )
    .on("error", (err, stdout, stderr) => {
      console.error("Error:", err);
      console.error("ffmpeg stderr:", stderr);
    })
    .on("end", (output) => {
      console.log("Video created =", output);
      allInProgress -= 1;
      allRemaining -= 1;
      if (allRemaining === 0) combineAll(camera);
      if (allImgPaths.length > 0 && allInProgress < 3) makeVid(camera);
    });
}

function executeVideoshow(camera = "120") {
  copyImgs(camera);

  if (existsSync(destDir)) rmSync(destDir, { recursive: true });
  if (!existsSync(destDir)) mkdirSync(destDir);
  if (!existsSync(`${destDir}/${camera}`)) mkdirSync(`${destDir}/${camera}`);

  allImgPaths = readdirSync(`${srcDir}/${camera}`).map(
    (m) => `./${srcDir}/${camera}/${m}`
  );

  totalPassesNeeded = Math.ceil(allImgPaths.length / bucketAmt);
  allRemaining = totalPassesNeeded;

  makeVid(camera);
  if (totalPassesNeeded > 1) makeVid(camera);
  if (totalPassesNeeded > 2) makeVid(camera);
}

executeVideoshow(cameraNum);
