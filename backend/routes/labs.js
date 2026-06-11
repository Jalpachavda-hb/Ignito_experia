import express from "express";
import { LABS, SUB_LABS } from "../config/labs.js";

const router = express.Router();

router.get("/", (req, res) => {
  res.json(LABS);
});

router.get("/sub-labs", (req, res) => {
  res.json(SUB_LABS);
});

router.get("/:id", (req, res) => {
  const lab = LABS.find((l) => l.id === req.params.id);
  if (lab) {
    res.json({ success: true, lab });
  } else {
    res.status(404).json({ success: false, message: "Lab not found" });
  }
});

router.patch("/:id/credits", (req, res) => {
  const { credits } = req.body;
  const labIndex = LABS.findIndex((l) => l.id === req.params.id);

  if (labIndex !== -1) {
    LABS[labIndex].credits = credits;
    console.log(`[LABS] Updated credits for ${req.params.id} to ${credits}`);
    res.json({ success: true, lab: LABS[labIndex] });
  } else {
    res.status(404).json({ success: false, message: "Lab not found" });
  }
});

export { LABS };
export default router;
