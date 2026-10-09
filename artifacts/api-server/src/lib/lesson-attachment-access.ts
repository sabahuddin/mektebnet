import { db, ilmihalLekcijeTable, ucenikProfiliTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { canReadLesson, type LessonViewer } from "./lesson-visibility.js";

type AttachmentAccess = {
  kind: string;
  approved: boolean;
  uploadedByUserId: number | null;
  lekcijaId: number;
};

export function isLessonExercise(attachment: Pick<AttachmentAccess, "kind">): boolean {
  return attachment.kind === "h5p" || attachment.kind === "embed";
}

export function canSeeLessonAttachment(
  user: LessonViewer | undefined,
  attachment: AttachmentAccess,
  studentMuallimId?: number | null,
): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.role === "muallim") {
    return attachment.approved || attachment.uploadedByUserId === user.userId;
  }
  if (!isLessonExercise(attachment)) return false;
  return attachment.approved || (
    user.role === "ucenik" && studentMuallimId != null
    && attachment.uploadedByUserId === studentMuallimId
  );
}

/** Isti pristup za listu, H5P fajlove, pokušaje i nagrade. Nacrt lekcije ostaje privatan. */
export async function canUseLessonExercise(
  user: LessonViewer,
  attachment: AttachmentAccess,
): Promise<boolean> {
  if (!isLessonExercise(attachment)) return false;
  if (user.role === "admin"
    || (user.role === "muallim" && attachment.uploadedByUserId === user.userId)) return true;
  const [lessons, profiles] = await Promise.all([
    db.select().from(ilmihalLekcijeTable).where(eq(ilmihalLekcijeTable.id, attachment.lekcijaId)).limit(1),
    user.role === "ucenik"
      ? db.select({ muallimId: ucenikProfiliTable.muallimId }).from(ucenikProfiliTable)
        .where(eq(ucenikProfiliTable.userId, user.userId)).limit(1)
      : Promise.resolve([]),
  ]);
  const lesson = lessons[0];
  const muallimId = profiles[0]?.muallimId;
  return !!lesson && canSeeLessonAttachment(user, attachment, muallimId)
    && canReadLesson(user, lesson, muallimId);
}
