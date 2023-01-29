import { execSync } from "node:child_process";
import path, { normalize } from "node:path";
import * as url from "url";
import {
  existsSync,
  mkdirSync,
  rmSync,
  readdirSync,
  copyFileSync,
  writeFileSync as wfs,
} from "node:fs";
import videoshow from "videoshow";
import {
  srcPathImgsRoot,
  destPathImgsRoot,
  destPathAllVideoRoot,
  allCameras,
  emailCfg,
  fileShare,
} from "./config.js";

const timeStart = Date.now();
const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const execOpts = {
  // stdio: "inherit", // If uncommented then execSync does NOT return data
  encoding: "utf-8",
  shell: "powershell",
  windowsHide: true,
};

let camerasList = [];
// const today = "2023-01-28"; // FOR_TESTING
const today = new Date(new Date().setHours(12)).toISOString().split("T")[0];
const today2 = today.replace(/-/g, "");

let totalPassesNeeded = 0;
let allRemaining = 0;
let allInProgress = 0;
let currentCount = 0;
let allImgPaths = [];
const bucketAmt = 300;

const srcDir = "imgs";
const destDir = "videos";

function sendEmail(link, email) {
  const startedOn = new Date(timeStart).toLocaleString();
  const endedOn = new Date().toLocaleString();
  const body = `Start: ${startedOn} | End: ${endedOn} | <a href='${link}'>VIEW_ALL_HERE</a>`;
  const creds = `-emailuser "${emailCfg.from}" -emailpass "${emailCfg.pass}"`;

  const scriptEmail = path.join(__dirname, "./send-email.ps1");
  const scriptArgs = `-emailto "${email}" -emailsubject "${emailCfg.subject}" -emailbody "${body}" ${creds}`;

  execSync(`${scriptEmail} ${scriptArgs}`, execOpts);
}

function copyImgs(camera) {
  if (existsSync(srcDir)) rmSync(srcDir, { recursive: true });
  if (!existsSync(srcDir)) mkdirSync(srcDir);
  if (!existsSync(`${srcDir}/${camera}`)) mkdirSync(`${srcDir}/${camera}`);

  let srcPathImgsRaw = `${srcPathImgsRoot}${camera}/${today}`;

  if (camera?.includes("ipcam")) {
    srcPathImgsRaw = `${srcPathImgsRoot}${camera}/${today2}/images`;
  }
  const srcPathImgs = normalize(srcPathImgsRaw);
  const destPathImgs = normalize(`${destPathImgsRoot}/${camera}`);

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
    `powershell -command "ffmpeg -loglevel error -f concat -safe 0 -i videos/${camera}-vidlist.txt -c copy videos/${camera}-all.mp4"`,
    execOpts
  );

  const destDir = normalize(`${fileShare}/${today}`);

  if (!existsSync(destDir)) mkdirSync(destDir);

  const filePath = normalize(`${destPathAllVideoRoot}/${camera}-all.mp4`);

  copyFileSync(filePath, `${destDir}\\${camera}.mp4`);

  if (camerasList.length > 0) {
    camerasList.splice(0, 1);
    executeVideoshow(camerasList[0]);
  }

  if (camerasList.length < 1) sendEmail(emailCfg.link, emailCfg.admin);
}

function makeVid(camera) {
  currentCount += 1;
  allInProgress += 1;
  const group = allImgPaths.splice(0, bucketAmt);
  const savePath = `./${destDir}/${camera}/${currentCount}-video.mp4`;

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
    .save(savePath)
    .on("start", (cmd) =>
      console.log(
        `ffmpeg_started | camera: ${camera} | allRemaining: ${allRemaining}`
      )
    )
    .on("error", (err, stdout, stderr) => {
      console.error("ffmpeg_Error:", err);
      console.error("ffmpeg_stderr:", stderr);
    })
    .on("end", (output) => {
      console.log("Video created =", output);
      allInProgress -= 1;
      allRemaining -= 1;
      if (allRemaining === 0) combineAll(camera);
      if (allImgPaths.length > 0 && allInProgress < 3) makeVid(camera);
    });
}

function executeVideoshow(camera) {
  if (!camera) return "STOP!";

  totalPassesNeeded = 0;
  allRemaining = 0;
  allInProgress = 0;
  currentCount = 0;
  allImgPaths = [];

  copyImgs(camera);

  if (existsSync(destDir)) rmSync(destDir, { recursive: true });
  if (!existsSync(destDir)) mkdirSync(destDir);
  if (!existsSync(`${destDir}/${camera}`)) mkdirSync(`${destDir}/${camera}`);

  allImgPaths = readdirSync(`${srcDir}/${camera}`).map(
    (m) => `./${srcDir}/${camera}/${m}`
  );

  console.log(
    `----- camera: ${camera} | allImgPaths.length: ${allImgPaths.length} -----`
  );

  totalPassesNeeded = Math.ceil(allImgPaths.length / bucketAmt);
  allRemaining = totalPassesNeeded;

  makeVid(camera); // always fire up one process
  if (totalPassesNeeded > 1) makeVid(camera);
  if (totalPassesNeeded > 2) makeVid(camera);
}

function start() {
  allCameras.forEach((camera) => {
    let srcPathImgsRaw = `${srcPathImgsRoot}${camera}/${today}`;

    if (camera?.includes("ipcam")) {
      srcPathImgsRaw = `${srcPathImgsRoot}${camera}/${today2}/images`;
    }
    const srcPathImgs = normalize(srcPathImgsRaw);
    const dirWithJpgs = readdirSync(srcPathImgs).filter((f) =>
      f.includes(".jpg")
    );

    if (dirWithJpgs.length) camerasList.push(camera);
  });

  executeVideoshow(camerasList[0]);
}

start();
