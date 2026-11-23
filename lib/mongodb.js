import { MongoClient } from "mongodb";

const globalCache = globalThis;

export async function getMongoDb() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    const error = new Error("MONGODB_URI is not configured");
    error.code = "MONGODB_URI_MISSING";
    throw error;
  }

  let parsedUri;
  try {
    parsedUri = new URL(uri);
  } catch {
    const error = new Error("MONGODB_URI is invalid");
    error.code = "MONGODB_URI_INVALID";
    throw error;
  }

  if (!["mongodb:", "mongodb+srv:"].includes(parsedUri.protocol)) {
    const error = new Error("MONGODB_URI must use the MongoDB protocol");
    error.code = "MONGODB_URI_INVALID_PROTOCOL";
    throw error;
  }

  if (!parsedUri.hostname) {
    const error = new Error("MONGODB_URI must include a hostname");
    error.code = "MONGODB_URI_MISSING_HOST";
    throw error;
  }

  if (!parsedUri.pathname || parsedUri.pathname === "/") {
    const error = new Error("MONGODB_URI must include the existing database name");
    error.code = "MONGODB_URI_MISSING_DATABASE";
    throw error;
  }

  if (!globalCache.__tcpMongoClientPromise) {
    const client = new MongoClient(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
    });
    const clientPromise = client.connect();
    globalCache.__tcpMongoClientPromise = clientPromise;
    clientPromise.catch(() => {
      if (globalCache.__tcpMongoClientPromise === clientPromise) {
        delete globalCache.__tcpMongoClientPromise;
      }
    });
  }

  const client = await globalCache.__tcpMongoClientPromise;
  return client.db();
}

export function getMongoDiagnostics(error) {
  const uri = process.env.MONGODB_URI;
  let hostname;

  if (uri) {
    try {
      hostname = new URL(uri).hostname;
    } catch {
      hostname = undefined;
    }
  }

  const causes = [error, error?.cause, error?.cause?.cause];
  const diagnosticError = causes.find((candidate) =>
    candidate && (
      typeof candidate.code === "string"
      || typeof candidate.code === "number"
      || typeof candidate.codeName === "string"
    ),
  ) || error;
  const code = diagnosticError && (
    typeof diagnosticError.code === "string" || typeof diagnosticError.code === "number"
  ) ? diagnosticError.code : undefined;

  let failureType = "connection";
  if (code === "MONGODB_URI_MISSING") {
    failureType = "configuration_missing";
  } else if (typeof code === "string" && code.startsWith("MONGODB_URI_")) {
    failureType = "configuration_invalid";
  } else if (causes.some((candidate) => candidate?.code === "ENOTFOUND")) {
    failureType = "dns_or_srv_resolution";
  } else if (code === 18 || diagnosticError?.codeName === "AuthenticationFailed") {
    failureType = "authentication";
  }

  return {
    failureType,
    hostname,
    name: typeof diagnosticError?.name === "string" ? diagnosticError.name : "Error",
    code,
    codeName: typeof diagnosticError?.codeName === "string" ? diagnosticError.codeName : undefined,
  };
}
