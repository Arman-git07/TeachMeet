// src/utils/deleteItem.ts
import { doc, deleteDoc } from "firebase/firestore";
import { getStorage, ref as storageRef, deleteObject } from "firebase/storage";
import { db } from "@/lib/firebase"; // adjust path if needed

export async function deleteFirestoreItem(classroomId: string, collectionName: string, id: string, storagePath?: string) {
  console.log("🔹 deleteFirestoreItem called", { classroomId, collectionName, id, storagePath });
  if (!id) throw new Error("Missing document id");

  // Also try to delete from storage if a path is provided
  if (storagePath) {
      const storage = getStorage();
      const fileRef = storageRef(storage, storagePath);
      try {
        await deleteObject(fileRef);
        console.log("🔸 Storage file deleted successfully", storagePath);
      } catch (error: any) {
        if (error.code === 'storage/object-not-found') {
            console.warn("🟡 Storage file not found, skipping.", storagePath);
        } else {
            // Re-throw other storage errors
            throw new Error(`Storage deletion failed: ${error.message}`);
        }
      }
  }

  const docRef = doc(db, "classrooms", classroomId, collectionName, id);
  await deleteDoc(docRef);
  console.log("🔸 Firestore document deleted successfully", id);
}
