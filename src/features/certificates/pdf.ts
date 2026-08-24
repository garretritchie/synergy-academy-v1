export async function downloadCertificatePdf(
  element: HTMLElement,
  certificateNumber: string,
) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);
  const canvas = await html2canvas(element, {
    backgroundColor: "#ffffff",
    scale: 2,
    useCORS: true,
    logging: false,
  });
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "in",
    format: "letter",
    compress: true,
  });
  const image = canvas.toDataURL("image/png", 1);
  pdf.addImage(image, "PNG", 0, 0, 11, 8.5, undefined, "FAST");
  pdf.setProperties({
    title: `Synergy Academy Certificate ${certificateNumber}`,
    subject: "Synergy Academy digital certificate",
    author: "Synergy Bahamas",
  });
  pdf.save(`${certificateNumber}.pdf`);
}
