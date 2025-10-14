
// src/lib/roles.ts
import { db } from "@/lib/firebase";
import {
  doc, getDoc, collection, getDocs,
} from "firebase/firestore";

/** Roles we support */
export type Role = "creator" | "teacher" | "student" | "none";

/** Safely reads a field as an array and checks membership */
function listHasUid(listLike: any, uid: string) {
  return Array.isArray(listLike) && listLike.includes(uid);
}

/** Resolve creator considering multiple legacy keys */
function resolveCreatorId(cls: any): string | null {
  // Prioritize teacherId as it's consistently used in creation logic.
  return (
    cls?.teacherId ??
    cls?.createdBy ??
    cls?.creatorId ??
    cls?.ownerId ??
    null
  );
}


/** Check teacher membership from array field or subcollection */
async function isSubjectTeacher(classId: string, cls: any, uid: string) {
  if (!uid) return false;

  // Handle new shape where teachers are objects
  if (Array.isArray(cls?.teachers)) {
    if (cls.teachers.some((t: any) => t && t.uid === uid)) {
      return true;
    }
  }

  // Handle legacy shapes
  if (listHasUid(cls?.subjectTeachers, uid)) return true;
  if (listHasUid(cls?.teachers, uid)) return true;

  // Subcollection fallback
  try {
    const teacherRef = doc(db, "classrooms", classId, "teachers", uid);
    const teacherSnap = await getDoc(teacherRef);
    if (teacherSnap.exists()) return true;

    const subSnap = await getDocs(collection(db, "classrooms", classId, "subjectTeachers"));
    for (const d of subSnap.docs) {
      const data = d.data();
      if (d.id === uid || data?.uid === uid || data?.teacherId === uid) return true;
    }
  } catch {}
  return false;
}

/** Check student membership from array field or subcollection */
async function isStudent(classId: string, cls: any, uid: string) {
  if (!uid) return false;
  
  if (listHasUid(cls?.students, uid)) return true;
  if (listHasUid(cls?.members, uid)) return true;
  if (listHasUid(cls?.enrolled, uid)) return true;

  // Subcollection fallback
  try {
    const participantRef = doc(db, "classrooms", classId, "participants", uid);
    const participantSnap = await getDoc(participantRef);
    if(participantSnap.exists() && participantSnap.data().role === 'student') return true;

    const studentRef = doc(db, "classrooms", classId, "students", uid);
    const studentSnap = await getDoc(studentRef);
    if (studentSnap.exists()) return true;

  } catch {}
  return false;
}


/** Public API: resolve the role for a user in a classroom */
export async function resolveRoleForUser(
  classroomId: string,
  uid: string | undefined | null
): Promise<{ role: Role; classroom: any }> {
  const ref = doc(db, "classrooms", classroomId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { role: "none", classroom: null };

  const cls = snap.data();
  if (!uid) return { role: "none", classroom: { id: classroomId, ...cls } };

  // 1) Creator (highest priority)
  const creatorId = resolveCreatorId(cls);
  if (creatorId && creatorId === uid) {
    return { role: "creator", classroom: { id: classroomId, ...cls } };
  }

  // 2) Subject Teacher
  if (await isSubjectTeacher(classroomId, cls, uid)) {
    return { role: "teacher", classroom: { id: classroomId, ...cls } };
  }

  // 3) Student
  if (await isStudent(classroomId, cls, uid)) {
    return { role: "student", classroom: { id: classroomId, ...cls } };
  }

  // 4) None
  return { role: "none", classroom: { id: classroomId, ...cls } };
}

/** Convenience booleans for UI */
export function canPost(role: Role) {
  return role === "creator" || role === "teacher";
}
export function canManage(role: Role) {
  return role === "creator" || role === "teacher";
}
