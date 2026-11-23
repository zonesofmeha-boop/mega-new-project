import { getMongoDb, getMongoDiagnostics } from "../lib/mongodb.js";

const MAX_BODY_BYTES = 3 * 1024 * 1024;
const MAX_HISTORY_LENGTH = 500;
const MAX_EVENTS_LENGTH = 5000;
const MAX_PACKET_HISTORY_LENGTH = 2000;
const SCENARIO_CATEGORIES = new Set(["Normal", "Failures", "Advanced"]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isString(value, maxLength) {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

function isUuid(value) {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function validateSimulation(body) {
  return isRecord(body)
    && isUuid(body.simulationId)
    && isRecord(body.scenario)
    && isString(body.scenario.id, 100)
    && isString(body.scenario.title, 200)
    && SCENARIO_CATEGORIES.has(body.scenario.category)
    && Array.isArray(body.history)
    && body.history.length <= MAX_HISTORY_LENGTH
    && Array.isArray(body.events)
    && body.events.length <= MAX_EVENTS_LENGTH
    && Array.isArray(body.packetHistory)
    && body.packetHistory.length <= MAX_PACKET_HISTORY_LENGTH
    && isRecord(body.clientState)
    && isRecord(body.serverState)
    && isRecord(body.result);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "GET") {
    const simulationId = req.query?.simulationId;
    if (!isUuid(simulationId)) {
      return res.status(400).json({
        success: false,
        message: "A valid simulationId is required",
      });
    }

    try {
      const db = await getMongoDb();
      const simulation = await db.collection("simulationRuns")
        .findOne({ simulationId });

      if (!simulation) {
        return res.status(404).json({
          success: false,
          message: "Simulation history not found",
        });
      }

      return res.status(200).json({ success: true, simulation });
    } catch (error) {
      console.error("Could not retrieve simulator history", getMongoDiagnostics(error));
      return res.status(500).json({
        success: false,
        message: "Unable to retrieve simulator history",
      });
    }
  }

  if (req.method === "POST") {
    if (!isRecord(req.body)) {
      return res.status(400).json({
        success: false,
        message: "A JSON simulation record is required",
      });
    }

    let bodySize;
    try {
      bodySize = Buffer.byteLength(JSON.stringify(req.body), "utf8");
    } catch {
      return res.status(400).json({
        success: false,
        message: "Invalid simulation record",
      });
    }

    if (bodySize > MAX_BODY_BYTES) {
      return res.status(413).json({
        success: false,
        message: "Simulation record is too large",
      });
    }

    if (!validateSimulation(req.body)) {
      return res.status(400).json({
        success: false,
        message: "Simulation record is missing required fields or exceeds supported history limits",
      });
    }

    try {
      const db = await getMongoDb();
      const now = new Date();
      const document = {
        simulationId: req.body.simulationId,
        scenario: {
          id: req.body.scenario.id,
          title: req.body.scenario.title,
          category: req.body.scenario.category,
        },
        history: req.body.history,
        events: req.body.events,
        packetHistory: req.body.packetHistory,
        clientState: req.body.clientState,
        serverState: req.body.serverState,
        result: req.body.result,
        updatedAt: now,
      };

      await db.collection("simulationRuns").updateOne(
        { simulationId: document.simulationId },
        {
          $set: document,
          $setOnInsert: { createdAt: now },
        },
        { upsert: true },
      );

      return res.status(200).json({
        success: true,
        message: "Simulation history saved",
        simulationId: document.simulationId,
      });
    } catch (error) {
      console.error("Could not save simulator history", getMongoDiagnostics(error));
      return res.status(500).json({
        success: false,
        message: "Unable to save simulator history",
      });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({
    success: false,
    message: "Method not allowed",
  });
}
