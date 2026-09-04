type H5PInstance = {
  contentId?: string | number;
};

type H5PWindow = {
  H5P?: {
    instances?: H5PInstance[];
  };
  H5PIntegration?: {
    contents?: Record<string, unknown>;
  };
};

function contentKey(contentId: string | number): string {
  return `cid-${String(contentId)}`;
}

/**
 * Uklanja samo DOM čvor koji pripada jednoj H5P instanci i briše njene
 * registracije iz singleton runtime-a. H5P standalone nema javni destroy API,
 * pa bez ovoga H5P.instances i H5PIntegration.contents rastu pri svakom
 * zatvaranju i ponovnom otvaranju modala.
 */
export function cleanupH5PInstance(
  runtime: H5PWindow,
  container: HTMLElement | null,
  instanceId: string | number,
): void {
  const id = String(instanceId);
  const content = Array.from(
    container?.querySelectorAll("[data-content-id]") ?? [],
  ).find((element) => element.getAttribute("data-content-id") === id);
  const playerRoot = content?.closest(".h5p-iframe, .h5p-iframe-wrapper") ?? content;
  playerRoot?.remove();

  const contents = runtime.H5PIntegration?.contents;
  if (contents) {
    delete contents[contentKey(instanceId)];
  }

  const instances = runtime.H5P?.instances;
  if (Array.isArray(instances)) {
    runtime.H5P!.instances = instances.filter(
      (instance) => String(instance.contentId) !== id,
    );
  }
}