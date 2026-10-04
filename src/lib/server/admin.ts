import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import type { Timestamp as ClientTimestamp } from "firebase/firestore";

/** Tipos de types/index.ts, com Timestamp do firebase-admin. */
export type Doc<T> = { [K in keyof T]: T[K] extends ClientTimestamp ? Timestamp : T[K] };

function app() {
  if (getApps().length) return getApps()[0];
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  // Sem credencial (ex.: emulador) só o projectId basta.
  return initializeApp(
    json
      ? { credential: cert(JSON.parse(json)) }
      : { projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID },
  );
}

let dbPronto = false;
export function adminDb() {
  const db = getFirestore(app());
  if (!dbPronto) {
    db.settings({ ignoreUndefinedProperties: true }); // campos opcionais ficam ausentes
    dbPronto = true;
  }
  return db;
}
export const adminAuth = () => getAuth(app());
export { Timestamp };
