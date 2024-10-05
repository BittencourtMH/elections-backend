import fs from "fs";
import path from "path";
import url from "url";

import {
  EA11ElectionSettings,
  EA11OfficeOrQuestion,
  EA12MunicipalitySettings,
} from "@bittencourt/elections-common";

const INTERVAL = 20;
const API = "https://resultados.tse.jus.br/oficial";

let pending = false;
let lastRequest = 0;

const download = async (fileURL: string) => {
  while (pending || Date.now() - lastRequest < INTERVAL) {
    await new Promise((resolve) => setTimeout(resolve, INTERVAL));
  }

  pending = true;
  lastRequest = Date.now();

  const response = await fetch(fileURL);

  if (!response.ok) {
    throw Error(response.status + " " + response.statusText);
  }

  const content = await response.text();

  const file = path.resolve(
    url.fileURLToPath(import.meta.url),
    "../data" + new URL(fileURL).pathname
  );

  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  pending = false;

  return content;
};

const downloadResults = async (
  prefix: string,
  level: string,
  municipality: string,
  office: string,
  election: string
) => {
  const file = `${level}${municipality}-c${office}-e${election}-u.json`;

  await download(`${prefix}/dados/${level}/${file}`);
};

const downloadMunicipalitySettings = async (
  election: string,
  officesAndQuestions: EA11OfficeOrQuestion[]
) => {
  const prefix = `${API}/${settings.c}/${election}`;
  const electionPadded = election.padStart(6, "0");

  const municipalitySettings: EA12MunicipalitySettings = JSON.parse(
    await download(`${prefix}/config/mun-e${electionPadded}-cm.json`)
  );

  for (const officeOrQuestion of officesAndQuestions) {
    const officeOrQuestionId = officeOrQuestion.cd.padStart(4, "0");

    for (const level of municipalitySettings.abr) {
      await Promise.all(
        level.mu.map((municipality) =>
          downloadResults(
            prefix,
            level.cd,
            municipality.cd,
            officeOrQuestionId,
            electionPadded
          )
        )
      );
    }
  }
};

const settings: EA11ElectionSettings = JSON.parse(
  await download(`${API}/comum/config/ele-c.json`)
);

for (const day of settings.pl) {
  for (const election of day.e) {
    for (const level of election.abr) {
      if (level.cd === "br") {
        await downloadMunicipalitySettings(election.cd, level.cp);
      }
    }
  }
}
