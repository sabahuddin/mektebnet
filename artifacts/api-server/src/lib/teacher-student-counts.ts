type StudentAssignment = { muallimId: number | null; grupaId: number | null };
type GroupOwner = { id: number; muallimId: number };

/** Count each student once, under the teacher responsible for their group. */
export function countStudentsByTeacher(
  students: StudentAssignment[],
  groups: GroupOwner[],
  teacherIds: Set<number>,
): Map<number, number> {
  const ownerByGroup = new Map(groups.map((group) => [group.id, group.muallimId]));
  const counts = new Map(Array.from(teacherIds, (id) => [id, 0]));

  for (const student of students) {
    const owner = student.grupaId == null ? undefined : ownerByGroup.get(student.grupaId);
    // Ungrouped students (and stale group references) keep their direct teacher.
    const teacherId = owner != null && teacherIds.has(owner) ? owner : student.muallimId;
    if (teacherId != null && counts.has(teacherId)) {
      counts.set(teacherId, counts.get(teacherId)! + 1);
    }
  }

  return counts;
}