/** Shared by the group panel and printable report; both download a real XLSX. */
export async function downloadGroupExcel(grupaId: number, token: string, query = "") {
  const base = import.meta.env.VITE_API_BASE_URL || "/api";
  const response = await fetch(`${base}/muallim/grupa/${grupaId}/izvjestaj-excel${query ? `?${query}` : ""}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Izvještaj nije moguće preuzeti");
  const disposition = response.headers.get("content-disposition");
  const encoded = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const filename = encoded ? decodeURIComponent(encoded) : disposition?.match(/filename="([^"]+)"/)?.[1] || `izvjestaj_${grupaId}.xlsx`;
  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
