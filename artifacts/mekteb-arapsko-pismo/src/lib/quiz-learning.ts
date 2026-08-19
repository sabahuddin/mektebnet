export interface WrongAnswerRef {
  questionIndex: number;
}

export function reconcileRetryRemediation<T extends WrongAnswerRef>(
  wrongAnswers: T[],
  questionIndex: number,
  isCorrect: boolean,
  retryMode?: "immediate",
): T[] {
  if (!isCorrect || retryMode !== "immediate") return wrongAnswers;
  return wrongAnswers.filter((answer) => answer.questionIndex !== questionIndex);
}