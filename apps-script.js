// ============================================================
// MOOD TRACKER — Google Apps Script
// ============================================================
// Instructions :
// 1. Ouvre script.google.com → Nouveau projet
// 2. Colle ce code, remplace SHEET_ID par l'ID de ton Google Sheet
//    (l'ID est dans l'URL : docs.google.com/spreadsheets/d/SHEET_ID/edit)
// 3. Déploie : Déployer → Nouveau déploiement → Type: Application Web
//    - Exécuter en tant que : Moi
//    - Accès : Tout le monde (anonyme)
// 4. Copie l'URL de déploiement → colle-la dans index.html (APPS_SCRIPT_URL)
// ============================================================

const SHEET_ID = "COLLE_TON_SHEET_ID_ICI";
const SHEET_NAME = "Humeurs"; // nom de l'onglet (sera créé automatiquement)

function getOrCreateSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(["Timestamp", "Date", "Heure", "Humeur (1-10)", "Note"]);
    sheet.getRange(1, 1, 1, 5).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const sheet = getOrCreateSheet();

    const now = new Date(data.timestamp || new Date().toISOString());
    const dateStr = Utilities.formatDate(now, "Europe/Paris", "dd/MM/yyyy");
    const timeStr = Utilities.formatDate(now, "Europe/Paris", "HH:mm");

    sheet.appendRow([
      now.toISOString(),
      dateStr,
      timeStr,
      data.mood,
      data.note || ""
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    const sheet = getOrCreateSheet();
    const rows = sheet.getDataRange().getValues();

    // Skip header, return last 30 entries (most recent first)
    const entries = rows.slice(1)
      .reverse()
      .slice(0, 30)
      .map(row => ({
        timestamp: row[0],
        date: row[1],
        time: row[2],
        mood: row[3],
        note: row[4]
      }));

    return ContentService
      .createTextOutput(JSON.stringify({ success: true, entries }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
