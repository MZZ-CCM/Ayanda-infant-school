/* ==========================================================================
   Google Drive integration
   --------------------------------------------------------------------------
   Two modes:
   1. Linked documents (always available): staff paste a Google Drive / Docs /
      Sheets share link and it is filed under a category. Opening a document
      simply opens the Drive link in a new tab, so Drive's own sharing rules
      still apply.
   2. Connected Drive (when a Google OAuth Client ID is set in Settings):
      uses Google Identity Services to obtain a read-only Drive token and
      lists files from the configured school Drive folder, so they can be
      filed with one click instead of pasting links.

   Setup for mode 2 (done once by HR / Head Teacher):
     - Google Cloud Console → create OAuth 2.0 Client ID (Web application)
     - Authorised JavaScript origin: the address this portal is served from
     - Enable "Google Drive API" for the project
     - Paste the Client ID under Settings → Integrations
   ========================================================================== */

const Drive = {
  token: null,
  scriptLoaded: false,

  configured() { return !!(Store.db.school.googleClientId || "").trim(); },
  connected() { return !!this.token; },

  loadScript() {
    if (this.scriptLoaded) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true; s.defer = true;
      s.onload = () => { this.scriptLoaded = true; resolve(); };
      s.onerror = () => reject(new Error("Could not load Google Identity Services. Check your internet connection."));
      document.head.appendChild(s);
    });
  },

  async connect() {
    if (!this.configured()) throw new Error("No Google Client ID set. Ask HR or the Head Teacher to add one under Settings → Integrations.");
    await this.loadScript();
    return new Promise((resolve, reject) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: Store.db.school.googleClientId.trim(),
        scope: "https://www.googleapis.com/auth/drive.readonly",
        callback: (resp) => {
          if (resp.error) return reject(new Error(resp.error_description || resp.error));
          this.token = resp.access_token;
          resolve(resp);
        },
      });
      client.requestAccessToken();
    });
  },

  disconnect() { this.token = null; },

  async listFiles({ folderId, query } = {}) {
    if (!this.token) throw new Error("Not connected to Google Drive.");
    const parts = ["trashed = false"];
    if (folderId) parts.push(`'${folderId.replace(/'/g, "\\'")}' in parents`);
    if (query) parts.push(`name contains '${query.replace(/'/g, "\\'")}'`);
    const params = new URLSearchParams({
      q: parts.join(" and "),
      fields: "files(id,name,mimeType,webViewLink,modifiedTime,owners(displayName))",
      pageSize: "50",
      orderBy: "modifiedTime desc",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
    const r = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, { headers: { Authorization: `Bearer ${this.token}` } });
    if (r.status === 401) { this.token = null; throw new Error("Google Drive session expired. Please connect again."); }
    if (!r.ok) throw new Error(`Drive API error (${r.status})`);
    const j = await r.json();
    return j.files || [];
  },

  /* Map a Drive mimeType or share URL to the portal's document type. */
  typeFromMime(mime) {
    if (!mime) return "doc";
    if (mime.includes("folder")) return "folder";
    if (mime.includes("spreadsheet")) return "sheet";
    if (mime.includes("presentation")) return "slide";
    if (mime.includes("form")) return "form";
    if (mime.includes("pdf")) return "pdf";
    return "doc";
  },
  typeFromUrl(url) {
    const u = (url || "").toLowerCase();
    if (u.includes("/spreadsheets/")) return "sheet";
    if (u.includes("/presentation/")) return "slide";
    if (u.includes("forms.google") || u.includes("/forms/")) return "form";
    if (u.includes("/folders/")) return "folder";
    if (u.endsWith(".pdf") || u.includes("/file/d/")) return "pdf";
    return "doc";
  },
  isDriveUrl(url) { return /^(https?:\/\/)?(drive|docs|forms)\.google\.com\//i.test(url || ""); },

  /* Extract a folder id from a pasted Drive folder link (used in Settings). */
  folderIdFromUrl(url) {
    const m = (url || "").match(/\/folders\/([A-Za-z0-9_-]+)/);
    return m ? m[1] : (url || "").trim();
  },
};
