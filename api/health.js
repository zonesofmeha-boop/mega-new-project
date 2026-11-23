import { getMongoDb, getMongoDiagnostics } from "../lib/mongodb.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  try {
    const db = await getMongoDb();
    await db.command({ ping: 1 });

    return res.status(200).json({
      success: true,
      message: "MongoDB connected successfully!",
    });
  } catch (error) {
    console.error("MongoDB health check failed", getMongoDiagnostics(error));

    return res.status(500).json({
      success: false,
      message: "Database connection failed",
    });
  }
}