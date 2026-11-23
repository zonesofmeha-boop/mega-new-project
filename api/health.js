import { MongoClient } from "mongodb";

let clientPromise;

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({
        success: false,
        message: "Method not allowed"
      });
    }

    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI missing");
    }

    if (!clientPromise) {
      const client = new MongoClient(
        process.env.MONGODB_URI
      );
      clientPromise = client.connect();
    }

    const client = await clientPromise;

    await client.db("myDatabase").command({
      ping: 1
    });

    return res.status(200).json({
      success: true,
      message: "MongoDB connected successfully!"
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Database connection failed"
    });
  }
}