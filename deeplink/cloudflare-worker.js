export default {
  async fetch(request) {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>VoucherVault — Import</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: #f5f5f2;
      --surface: #ffffff;
      --surface-2: #f9f9f7;
      --border: rgba(0,0,0,0.09);
      --border-strong: rgba(0,0,0,0.15);
      --text: #1a1a18;
      --muted: #6b6b66;
      --hint: #9b9b96;
      --accent: #2563eb;
      --accent-bg: #eff6ff;
      --accent-border: rgba(37,99,235,0.2);
      --success: #166534;
      --success-bg: #f0fdf4;
      --success-border: rgba(22,101,52,0.2);
      --warn: #92400e;
      --warn-bg: #fffbeb;
      --warn-border: rgba(146,64,14,0.2);
      --danger: #991b1b;
      --danger-bg: #fef2f2;
      --danger-border: rgba(153,27,27,0.2);
      --radius: 10px;
      --radius-sm: 6px;
      --shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.05);
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #111110;
        --surface: #1c1c1a;
        --surface-2: #222220;
        --border: rgba(255,255,255,0.08);
        --border-strong: rgba(255,255,255,0.14);
        --text: #f0f0ec;
        --muted: #9b9b96;
        --hint: #6b6b66;
        --accent: #60a5fa;
        --accent-bg: rgba(96,165,250,0.08);
        --accent-border: rgba(96,165,250,0.2);
        --success: #86efac;
        --success-bg: rgba(134,239,172,0.07);
        --success-border: rgba(134,239,172,0.15);
        --warn: #fcd34d;
        --warn-bg: rgba(252,211,77,0.07);
        --warn-border: rgba(252,211,77,0.15);
        --danger: #fca5a5;
        --danger-bg: rgba(252,165,165,0.07);
        --danger-border: rgba(252,165,165,0.15);
        --shadow: 0 1px 3px rgba(0,0,0,0.3), 0 4px 16px rgba(0,0,0,0.25);
      }
    }

    html, body {
      min-height: 100%;
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
    }

    body {
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: 40px 16px 60px;
    }

    .wrapper {
      width: 100%;
      max-width: 480px;
    }

    .header {
      text-align: center;
      margin-bottom: 28px;
    }

    .logo-wrap {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 52px;
      height: 52px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      margin-bottom: 16px;
      box-shadow: var(--shadow);
    }

    .logo-wrap img {
      width: 32px;
      height: 32px;
      object-fit: contain;
    }

    .header h1 {
      font-size: 1.25rem;
      font-weight: 600;
      letter-spacing: -0.01em;
      color: var(--text);
    }

    .header p {
      font-size: 0.88rem;
      color: var(--muted);
      margin-top: 5px;
    }

    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      box-shadow: var(--shadow);
      overflow: hidden;
    }

    .card-section {
      padding: 20px 22px;
    }

    .card-section + .card-section {
      border-top: 1px solid var(--border);
    }

    .section-label {
      font-size: 0.72rem;
      font-weight: 600;
      letter-spacing: 0.07em;
      text-transform: uppercase;
      color: var(--hint);
      margin-bottom: 12px;
    }

    .import-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }

    .item-icon {
      flex-shrink: 0;
      width: 36px;
      height: 36px;
      border-radius: 9px;
      background: var(--accent-bg);
      border: 1px solid var(--accent-border);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .item-icon svg {
      width: 18px;
      height: 18px;
      stroke: var(--accent);
      fill: none;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .item-details {
      flex: 1;
      min-width: 0;
    }

    .item-name {
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .item-meta {
      font-size: 0.8rem;
      color: var(--muted);
      margin-top: 2px;
      word-break: break-all;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      font-size: 0.7rem;
      font-weight: 600;
      letter-spacing: 0.02em;
      padding: 2px 7px;
      border-radius: 99px;
      border: 1px solid;
      flex-shrink: 0;
      margin-top: 2px;
    }

    .badge-blue {
      background: var(--accent-bg);
      border-color: var(--accent-border);
      color: var(--accent);
    }

    .item-section-error {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .btn-primary:disabled {
      opacity: 0.4;
      cursor: not-allowed;
      transform: none;
    }

    .how-steps {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .step {
      display: flex;
      align-items: flex-start;
      gap: 10px;
    }

    .step-num {
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: var(--surface-2);
      border: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.7rem;
      font-weight: 600;
      color: var(--muted);
      margin-top: 1px;
    }

    .step-text {
      font-size: 0.86rem;
      color: var(--muted);
      line-height: 1.55;
    }

    .step-text strong {
      font-weight: 600;
      color: var(--text);
    }

    .alert {
      display: flex;
      gap: 10px;
      padding: 12px 14px;
      border-radius: var(--radius);
      border: 1px solid;
      font-size: 0.83rem;
      line-height: 1.55;
    }

    .alert svg {
      flex-shrink: 0;
      width: 15px;
      height: 15px;
      margin-top: 1px;
      fill: none;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .alert-warn {
      background: var(--warn-bg);
      border-color: var(--warn-border);
      color: var(--warn);
    }

    .alert-warn svg { stroke: var(--warn); }

    .alert-info {
      background: var(--accent-bg);
      border-color: var(--accent-border);
      color: var(--accent);
    }

    .alert-info svg { stroke: var(--accent); }

    .alert-success {
      background: var(--success-bg);
      border-color: var(--success-border);
      color: var(--success);
    }

    .alert-success svg { stroke: var(--success); }

    .alert-error {
      background: var(--danger-bg);
      border-color: var(--danger-border);
      color: var(--danger);
    }

    .alert-error svg { stroke: var(--danger); }

    .field label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.82rem;
      font-weight: 600;
      color: var(--text);
      margin-bottom: 7px;
    }

    .field label span {
      font-weight: 400;
      color: var(--hint);
    }

    .input-wrap {
      position: relative;
    }

    .input-icon {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      width: 15px;
      height: 15px;
      stroke: var(--hint);
      fill: none;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
      pointer-events: none;
    }

    input[type="url"], input[type="text"] {
      width: 100%;
      padding: 10px 12px 10px 36px;
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-sm);
      font-size: 0.9rem;
      font-family: inherit;
      color: var(--text);
      background: var(--surface);
      outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
    }

    input[type="url"]:focus, input[type="text"]:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(37,99,235,0.12);
    }

    @media (prefers-color-scheme: dark) {
      input[type="url"]:focus, input[type="text"]:focus {
        box-shadow: 0 0 0 3px rgba(96,165,250,0.15);
      }
    }

    .field-hint {
      margin-top: 5px;
      font-size: 0.77rem;
      color: var(--hint);
    }

    .target-preview {
      margin-top: 10px;
      padding: 8px 10px;
      border: 1px dashed var(--border-strong);
      border-radius: var(--radius-sm);
      font-size: 0.75rem;
      font-family: ui-monospace, "SF Mono", monospace;
      color: var(--muted);
      word-break: break-all;
      background: var(--surface-2);
    }

    .actions {
      display: flex;
      gap: 8px;
      margin-top: 16px;
    }

    .btn {
      appearance: none;
      border: none;
      border-radius: var(--radius-sm);
      padding: 10px 16px;
      font-size: 0.88rem;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      transition: opacity 0.15s, transform 0.1s;
      line-height: 1;
    }

    .btn:active { transform: scale(0.98); }

    .btn-primary {
      flex: 1;
      background: var(--accent);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }

    .btn-primary:hover { opacity: 0.88; }

    .btn-primary:disabled {
      opacity: 0.4;
      cursor: not-allowed;
      transform: none;
      pointer-events: none;
    }

    .btn-primary svg {
      width: 14px;
      height: 14px;
      stroke: #fff;
      fill: none;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .btn-ghost {
      background: var(--surface-2);
      border: 1px solid var(--border-strong);
      color: var(--muted);
      font-size: 0.82rem;
    }

    .btn-ghost:hover { color: var(--text); }

    .status-wrap {
      margin-top: 12px;
      min-height: 0;
    }

    .divider {
      height: 1px;
      background: var(--border);
      margin: 16px 0;
    }

    .path-pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 0.73rem;
      font-family: ui-monospace, "SF Mono", monospace;
      color: var(--muted);
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: 99px;
      padding: 3px 9px;
      margin-top: 8px;
      word-break: break-all;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .footer {
      text-align: center;
      margin-top: 20px;
      font-size: 0.75rem;
      color: var(--hint);
    }

    .footer a {
      color: var(--muted);
      text-decoration: none;
    }

    .footer a:hover { color: var(--text); }
  </style>
</head>
<body>
  <div class="wrapper">

    <div class="header">
      <div class="logo-wrap">
        <img src="https://raw.githubusercontent.com/l4rm4nd/VoucherVault/refs/heads/main/myapp/static/assets/img/logo.svg" alt="" />
      </div>
      <h1>VoucherVault Import</h1>
      <p>Deep-link importer for self-hosted instances</p>
    </div>

    <div class="card">
      <div class="card-section" id="itemSection">
        <div class="section-label">Item to import</div>
        <div class="import-item">
          <div class="item-icon">
            <svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
          </div>
          <div class="item-details">
            <div class="item-name" id="itemName">—</div>
            <div class="item-meta" id="itemMeta">Parsing import data…</div>
            <span class="badge badge-blue" id="itemType">Voucher</span>
          </div>
        </div>
      </div>

      <div class="card-section">
        <div class="section-label">How this works</div>
        <div class="how-steps">
          <div class="step">
            <div class="step-num">1</div>
            <div class="step-text">A website or service created this link with <strong>pre-filled data</strong> encoded in the URL fragment (<code style="font-size:0.85em;">#</code>), keeping it private from server logs.</div>
          </div>
          <div class="step">
            <div class="step-num">2</div>
            <div class="step-text">You provide your <strong>VoucherVault instance URL</strong>. It stays in your browser only.</div>
          </div>
          <div class="step">
            <div class="step-num">3</div>
            <div class="step-text">You are redirected to your instance. You must <strong>log in</strong> and <strong>manually confirm</strong> the item creation. Nothing is saved automatically.</div>
          </div>
        </div>

        <div class="divider"></div>

        <div class="alert alert-warn">
          <svg viewBox="0 0 24 24"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <div>
            <strong style="display:block;margin-bottom:2px;">Review before confirming</strong>
            Only proceed if you trust the source of this link. This service only redirects. It cannot access your vault, create items, or read your data.
          </div>
        </div>

        <div style="margin-top:10px;">
          <div class="alert alert-info">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <div>Your instance URL is stored locally in this browser using <code style="font-size:0.8em;">localStorage</code>.</div>
          </div>
        </div>
      </div>

      <div class="card-section">
        <div class="section-label">Your VoucherVault instance</div>

        <div class="field">
          <label for="instanceUrl">
            Instance URL
            <span id="storedLabel"></span>
          </label>
          <div class="input-wrap">
            <svg class="input-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            <input
              id="instanceUrl"
              type="url"
              placeholder="https://voucher.example.com"
              autocomplete="url"
              spellcheck="false"
              autocorrect="off"
              autocapitalize="off"
            />
          </div>
          <div class="field-hint">Your self-hosted VoucherVault URL, e.g. <code>https://vault.example.com</code></div>
          <div class="target-preview" id="targetPreview" hidden></div>
        </div>

        <div class="actions">
          <button type="button" class="btn btn-primary" id="goBtn" disabled>
            <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            Continue &amp; Import
          </button>
          <button type="button" class="btn btn-ghost" id="clearBtn">Forget</button>
        </div>

        <div class="status-wrap" id="statusWrap"></div>

      </div>
    </div>

    <div class="footer">
      Powered by <a href="https://github.com/l4rm4nd/VoucherVault" target="_blank" rel="noopener">VoucherVault</a>
      &mdash; open-source self-hosted voucher manager
    </div>
  </div>

<script>
(function () {
  function $(id) {
    return document.getElementById(id);
  }

  const STORAGE_KEY = "vv_instanceUrl";
  const currentUrl = new URL(window.location.href);
  const originalPath = currentUrl.pathname;
  // Read voucher data from the URL fragment (#) — never sent to the server,
  // so it never appears in Cloudflare worker request logs.
  const rawHash = window.location.hash.slice(1); // strip leading '#'
  const params = new URLSearchParams(rawHash);
  // Reconstruct as a query string to forward to the self-hosted instance
  const originalQuery = rawHash ? "?" + rawHash : "";

  const input = $("instanceUrl");
  const goBtn = $("goBtn");
  const clearBtn = $("clearBtn");
  const statusWrap = $("statusWrap");
  const storedLabel = $("storedLabel");
  const targetPreview = $("targetPreview");
  const pathPill = $("pathPill");

  const itemNameEl = $("itemName");
  const itemMetaEl = $("itemMeta");
  const itemTypeEl = $("itemType");

  const knownNameParams = ["name", "title", "description", "desc", "label", "company", "store", "merchant", "retailer", "brand"];
  const knownTypeParams = ["type", "category", "kind", "card_type", "voucher_type"];
  const knownCodeParams = ["code", "barcode", "number", "serial", "pin", "value"];

  function firstParam(keys) {
    for (const k of keys) {
      const v = params.get(k);
      if (v) return v;
    }
    return null;
  }

  function normalizeUrl(val) {
    let v = (val || "").trim();
    if (!v) return "";
    if (!/^https?:\\/\\//i.test(v)) v = "https://" + v;
    return v.replace(/\\/$/, "");
  }

  function isValidUrl(v) {
    try {
      const u = new URL(v);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch (e) {
      return false;
    }
  }

  function buildTarget(base) {
    return new URL("/items/create/" + originalQuery, base).toString();
  }

  function updatePreview() {
    if (!targetPreview || !input) return;

    const n = normalizeUrl(input.value);
    if (!n || !isValidUrl(n)) {
      targetPreview.hidden = true;
      return;
    }

    try {
      targetPreview.textContent = "→ " + buildTarget(n);
      targetPreview.hidden = false;
    } catch (e) {
      targetPreview.hidden = true;
    }
  }

  function setStatus(message, type) {
    if (!statusWrap) return;

    if (!message) {
      statusWrap.innerHTML = "";
      return;
    }

    const icons = {
      error: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>',
      info: '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>',
      success: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>'
    };

    const cssClass =
      type === "error" ? "alert-error" :
      type === "success" ? "alert-success" :
      "alert-info";

    statusWrap.innerHTML =
      '<div class="alert ' + cssClass + '" style="margin-top:10px;">' +
        '<svg viewBox="0 0 24 24" style="width:15px;height:15px;flex-shrink:0;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;">' +
          (icons[type] || icons.info) +
        '</svg>' +
        '<div>' + message + '</div>' +
      '</div>';
  }

  // Required parameters for a valid import link
  const REQUIRED_PARAMS = [
    { keys: knownNameParams, label: "name" },
    { keys: knownCodeParams, label: "code" },
    { keys: knownTypeParams, label: "type" }
  ];

  function validateImportParams() {
    // No hash at all
    if (!rawHash) {
      return { valid: false, error: "No import data found in this URL. The link is missing a <code>#fragment</code> with voucher parameters." };
    }
    // Check required params
    const missing = REQUIRED_PARAMS
      .filter(function (p) { return !firstParam(p.keys); })
      .map(function (p) { return "<code>" + p.label + "</code>"; });
    if (missing.length) {
      return { valid: false, error: "Required parameter" + (missing.length > 1 ? "s" : "") + " missing: " + missing.join(", ") + "." };
    }
    return { valid: true };
  }

  const validation = validateImportParams();

  // Populate import preview safely
  const itemName = firstParam(knownNameParams);
  const itemType = firstParam(knownTypeParams);
  const itemCode = firstParam(knownCodeParams);

  if (!validation.valid) {
    // Replace item preview section with an error state
    const itemSection = $("itemSection");
    if (itemSection) {
      itemSection.innerHTML =
        '<div class="section-label">Item to import</div>' +
        '<div class="alert alert-error">' +
          '<svg viewBox="0 0 24 24" style="flex-shrink:0;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;stroke:var(--danger);">' +
            '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>' +
            '<line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>' +
          '</svg>' +
          '<div><strong style="display:block;margin-bottom:2px;">Invalid import link</strong>' + validation.error + '</div>' +
        '</div>';
    }
    // Disable the import button
    if (goBtn) {
      goBtn.disabled = true;
      goBtn.title = "This link does not contain valid import data.";
    }
  } else {
    // Valid — enable the import button
    if (goBtn) {
      goBtn.disabled = false;
    }

    if (itemNameEl) {
      itemNameEl.textContent = itemName || "Unknown item";
    }

    if (itemMetaEl) {
      if (itemCode) {
        itemMetaEl.textContent = "Code: " + itemCode;
      } else if (Array.from(params.keys()).length) {
        const listed = Array.from(params.entries())
          .slice(0, 3)
          .map(function (entry) {
            return entry[0] + "=" + entry[1];
          })
          .join(" \u00b7 ");
        itemMetaEl.textContent = listed;
      } else {
        itemMetaEl.textContent = "No item data detected in URL";
      }
    }

    if (itemTypeEl) {
      const typeLabels = {
        voucher: "Voucher",
        giftcard: "Gift card",
        gift_card: "Gift card",
        coupon: "Coupon",
        loyalty: "Loyalty card",
        loyaltycard: "Loyalty card",
        loyalty_card: "Loyalty card"
      };
      itemTypeEl.textContent =
        typeLabels[(itemType || "").toLowerCase()] || (itemType ? itemType : "Voucher");
    }
  }

  if (pathPill) {
    pathPill.textContent = originalPath + (window.location.hash || "");
  }

  const stored = (localStorage.getItem(STORAGE_KEY) || "").trim();
  if (stored && input) {
    input.value = stored;
    if (storedLabel) storedLabel.textContent = "· remembered";
    updatePreview();
  }

  if (input) {
    input.addEventListener("input", updatePreview);

    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && goBtn) {
        goBtn.click();
      }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", function () {
      localStorage.removeItem(STORAGE_KEY);
      if (input) input.value = "";
      if (storedLabel) storedLabel.textContent = "";
      if (targetPreview) targetPreview.hidden = true;
      setStatus("Stored instance URL removed from this browser.", "info");
      if (input) input.focus();
    });
  }

  if (goBtn) {
    goBtn.addEventListener("click", function () {
      if (!input) return;

      const n = normalizeUrl(input.value);

      if (!n) {
        setStatus("Please enter your instance URL.", "error");
        input.focus();
        return;
      }

      if (!isValidUrl(n)) {
        setStatus('Please enter a valid <code>http://</code> or <code>https://</code> URL.', "error");
        input.focus();
        return;
      }

      try {
        const target = buildTarget(n);
        localStorage.setItem(STORAGE_KEY, n);
        setStatus("Redirecting to your instance&hellip;", "success");
        goBtn.disabled = true;
        setTimeout(function () {
          window.location.replace(target);
        }, 500);
      } catch (e) {
        setStatus("Could not build the redirect URL. Check your instance URL.", "error");
      }
    });
  }

  setTimeout(function () {
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }, 60);
})();
</script>
</body>
</html>`;

    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=UTF-8",
        "cache-control": "no-store",
        "x-frame-options": "SAMEORIGIN",
        "x-content-type-options": "nosniff",
        "referrer-policy": "no-referrer"
      }
    });
  }
};