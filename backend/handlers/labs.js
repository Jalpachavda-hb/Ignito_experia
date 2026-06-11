import { ok } from "../lib/apigw.js";
import { LABS } from "../config/labs.js";
import { notFound } from "../lib/errors.js";

export const labsListHandler = async () => ok({ labs: LABS });

export const labsGetHandler = async ({ pathParameters }) => {
  const labId = pathParameters?.labId;
  const lab = LABS.find((l) => l.id === labId);
  if (!lab) throw notFound("Lab not found");
  return ok({ lab });
};
export const subLabsHandler = async () => {
  const grouped = {};

  LABS.forEach((lab) => {
    const semester = lab.semester || "Other";

    if (!grouped[semester]) {
      grouped[semester] = [];
    }

    grouped[semester].push(lab);
  });

  return ok({ subLabs: grouped });
};