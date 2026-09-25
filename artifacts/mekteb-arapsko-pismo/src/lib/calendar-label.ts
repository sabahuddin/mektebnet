/** Calendar "Mekteb" is a class day, not the name of the platform. */
export function calendarLabel(label: string, t: (key: string) => string): string {
  if (label === "Mekteb") {
    const translated = t("Mekteb (kalendar)");
    return translated === "Mekteb (kalendar)" ? label : translated;
  }
  return t(label);
}