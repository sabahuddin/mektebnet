export type LessonVisibility = {
  dostupnost: string;
  isPublished: boolean;
  autorMuallimId: number | null;
  statusOdobrenja: string;
};

export type LessonViewer = {
  userId: number;
  role: string;
};

export function canReadLesson(
  user: LessonViewer | undefined,
  lesson: LessonVisibility,
  studentMuallimId?: number | null,
): boolean {
  if (user?.role === "admin") return lesson.statusOdobrenja !== "odbijeno";
  if (lesson.statusOdobrenja === "na_cekanju") {
    return user?.role === "muallim" && lesson.autorMuallimId === user.userId;
  }
  if (lesson.statusOdobrenja !== "odobreno" || !lesson.isPublished) return false;
  if (lesson.dostupnost === "svi") return true;
  if (lesson.dostupnost === "muallimi") return user?.role === "muallim";
  if (lesson.dostupnost === "autorovi_ucenici") {
    return (user?.role === "muallim" && lesson.autorMuallimId === user.userId)
      || (user?.role === "ucenik" && lesson.autorMuallimId === studentMuallimId);
  }
  return false;
}