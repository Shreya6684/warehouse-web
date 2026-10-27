"use strict";

/* WAREHOUSEPRO - Inventory Management System */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const byId = id => document.getElementById(id);

const money = n => Number(n || 0).toLocaleString("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2
});

const safe = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
}[ch]));

function getData(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function saveData(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    alert("Unable to save data in this browser.");
  }
}

function toast(message) {
  let box = byId("toastContainer");

  if (!box) {
    box = document.createElement("div");
    box.id = "toastContainer";
    box.className = "toast-container";
    document.body.appendChild(box);
  }

  const item = document.createElement("div");
  item.className = "toast";
  item.textContent = message;
  box.appendChild(item);
  setTimeout(() => item.remove(), 3000);
}

const defaultProducts = [
  {
    id: "P-1001",
    sku: "ELEC-011",
    name: "Wireless Mouse",
    category: "Electronics",
    price: 799,
    stock: 8,
    lowStockThreshold: 25,
    location: "A-01-01"
  },
  {
    id: "P-1002",
    sku: "ELEC-024",
    name: "USB-C Hub",
    category: "Electronics",
    price: 1499,
    stock: 4,
    lowStockThreshold: 20,
    location: "A-01-02"
  },
  {
    id: "P-1003",
    sku: "ACC-008",
    name: "Laptop Stand",
    category: "Accessories",
    price: 1199,
    stock: 0,
    lowStockThreshold: 15,
    location: "B-02-01"
  },
  {
    id: "P-1004",
    sku: "ELEC-031",
    name: "Mechanical Keyboard",
    category: "Electronics",
    price: 2499,
    stock: 45,
    lowStockThreshold: 10,
    location: "A-02-01"
  },
  {
    id: "P-1005",
    sku: "AUD-017",
    name: "Bluetooth Headphones",
    category: "Audio",
    price: 1999,
    stock: 60,
    lowStockThreshold: 12,
    location: "C-01-01"
  },
  {
    id: "P-1006",
    sku: "ACC-014",
    name: "Laptop Sleeve",
    category: "Accessories",
    price: 699,
    stock: 18,
    lowStockThreshold: 10,
    location: "B-01-03"
  }
];

let products = getData("warehouseProProducts", null);
if (!Array.isArray(products) || !products.length) {
  products = defaultProducts.map(p => ({ ...p }));
}

let movements = getData("warehouseProStockMovementHistory", []);
let incoming = getData("warehouseProIncomingShipments", []);
let outgoing = getData("warehouseProOutgoingShipments", []);

let locations = getData("warehouseProLocations", [
  {
    id: "LOC-01",
    zone: "A",
    aisle: "01",
    rack: "01",
    bin: "01",
    capacity: 100,
    used: 70
  },
  {
    id: "LOC-02",
    zone: "A",
    aisle: "01",
    rack: "01",
    bin: "02",
    capacity: 100,
    used: 54
  },
  {
    id: "LOC-03",
    zone: "B",
    aisle: "02",
    rack: "01",
    bin: "01",
    capacity: 80,
    used: 45
  }
]);

let activities = getData("warehouseProActivities", []);

function persistAll() {
  saveData("warehouseProProducts", products);
  saveData("warehouseProStockSnapshot", products);
  saveData("warehouseProStockMovementHistory", movements);
  saveData("warehouseProIncomingShipments", incoming);
  saveData("warehouseProOutgoingShipments", outgoing);
  saveData("warehouseProLocations", locations);
  saveData("warehouseProActivities", activities);
}

function makeId(prefix) {
  return prefix + "-" + Date.now().toString().slice(-7);
}

function stockOf(product) {
  return Number(product.stock || 0);
}

function valueOf(product) {
  return stockOf(product) * Number(product.price || 0);
}

function stockStatus(product) {
  if (stockOf(product) <= 0) return "Out of Stock";
  if (stockOf(product) <= Number(product.lowStockThreshold || 10)) {
    return "Low Stock";
  }
  return "In Stock";
}

function addActivity(type, title, detail, quantity, reference = "") {
  activities.unshift({
    type,
    title,
    detail,
    quantity,
    reference,
    status: "Completed",
    time: new Date().toLocaleString("en-IN")
  });

  activities = activities.slice(0, 100);
  persistAll();
}

function recordMovement(product, type, quantity, note = "") {
  movements.unshift({
    id: makeId("MOV"),
    productId: product.id,
    productName: product.name,
    sku: product.sku,
    type,
    quantity: Number(quantity),
    note,
    timestamp: Date.now(),
    date: new Date().toLocaleString("en-IN")
  });

  persistAll();
}

function renderStatistics() {
  const low = products.filter(
    p => stockOf(p) > 0 && stockOf(p) <= p.lowStockThreshold
  ).length;

  const out = products.filter(p => stockOf(p) <= 0).length;

  const inStock = products.filter(
    p => stockOf(p) > p.lowStockThreshold
  ).length;

  const totalValue = products.reduce((sum, p) => sum + valueOf(p), 0);

  const stats = {
    totalProducts: products.length,
    lowStockCount: low,
    shipmentCount: incoming.length + outgoing.length,
    inventoryValue: money(totalValue),
    distributionTotal: products.length,
    inStockCount: inStock,
    distributionLow: low,
    outStockCount: out
  };

  Object.entries(stats).forEach(([id, value]) => {
    const element = byId(id);
    if (element) element.textContent = value;
  });

  renderAlerts();
  renderActivities();
  renderDonutChart();
}

function renderDonutChart() {
  const chart = byId("donutChart");
  if (!chart) return;

  const inStock = products.filter(
    p => stockOf(p) > p.lowStockThreshold
  ).length;

  const low = products.filter(
    p => stockOf(p) > 0 && stockOf(p) <= p.lowStockThreshold
  ).length;

  const out = products.filter(p => stockOf(p) <= 0).length;
  const total = Math.max(1, inStock + low + out);

  const a = inStock / total * 100;
  const b = (inStock + low) / total * 100;

  chart.style.background =
    `conic-gradient(#21B982 0% ${a}%, #F2AE47 ${a}% ${b}%, #EF647B ${b}% 100%)`;
}

function renderMovementChart() {
  const chart = byId("movementChart");
  const labels = byId("chartLabels");
  if (!chart || !labels) return;

  const period = Number(byId("chartPeriod")?.value) === 30 ? 30 : 7;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days = Array.from({ length: period }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (period - index - 1));
    return { date, stockIn: 0, stockOut: 0 };
  });
  const dayIndexes = new Map(days.map((day, index) => [
    day.date.toDateString(),
    index
  ]));

  movements.forEach(movement => {
    const timestamp = Number(movement.timestamp);
    if (!Number.isFinite(timestamp) || timestamp <= 0) return;

    const movementDate = new Date(timestamp);
    movementDate.setHours(0, 0, 0, 0);
    const index = dayIndexes.get(movementDate.toDateString());
    if (index === undefined) return;

    const type = String(movement.type || "").toLowerCase();
    const quantity = Math.abs(Number(movement.quantity) || 0);
    if (type.includes("out")) days[index].stockOut += quantity;
    else if (type.includes("in")) days[index].stockIn += quantity;
  });

  const hasMovements = days.some(day => day.stockIn || day.stockOut);
  const maxValue = Math.max(
    1,
    ...days.map(day => Math.max(day.stockIn, day.stockOut))
  );
  const scaleMax = Math.max(3, Math.ceil(maxValue / 3) * 3);
  const x = index => 48 + index * (572 / Math.max(1, period - 1));
  const y = value => 210 - value / scaleMax * 175;
  const linePath = key => days.map((day, index) =>
    `${index ? "L" : "M"}${x(index).toFixed(1)},${y(day[key]).toFixed(1)}`
  ).join(" ");
  const areaPath = key =>
    `${linePath(key)} L${x(period - 1).toFixed(1)},210 L48,210 Z`;
  const gridValues = [scaleMax, scaleMax * 2 / 3, scaleMax / 3, 0];

  chart.innerHTML = `
    <defs>
      <linearGradient id="purpleGradient" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="#8B5CF6" stop-opacity=".2"/>
        <stop offset="100%" stop-color="#8B5CF6" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="lilacGradient" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="#C6ACFF" stop-opacity=".2"/>
        <stop offset="100%" stop-color="#C6ACFF" stop-opacity="0"/>
      </linearGradient>
    </defs>
    ${gridValues.map((value, index) => {
      const lineY = 35 + index * (175 / 3);
      return `<line class="chart-grid-line" x1="48" y1="${lineY}" x2="620" y2="${lineY}"/>
        <text class="chart-axis-label" x="40" y="${lineY + 4}" text-anchor="end">${Math.round(value)}</text>`;
    }).join("")}
    <path class="chart-area-purple" d="${areaPath("stockIn")}"/>
    <path class="chart-area-lilac" d="${areaPath("stockOut")}"/>
    <path class="chart-line-purple" d="${linePath("stockIn")}"/>
    <path class="chart-line-lilac" d="${linePath("stockOut")}"/>
    ${hasMovements ? "" : `<text class="chart-axis-label" x="334" y="125" text-anchor="middle">No stock movements in this period</text>`}
  `;

  const labelIndexes = new Set([
    0,
    Math.round((period - 1) / 4),
    Math.round((period - 1) / 2),
    Math.round((period - 1) * 3 / 4),
    period - 1
  ]);
  labels.innerHTML = days.map((day, index) =>
    labelIndexes.has(index)
      ? `<span>${day.date.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>`
      : "<span></span>"
  ).join("");
}

function renderAlerts() {
  const list = byId("alertList");
  if (!list) return;

  const alerts = products.filter(
    p => stockOf(p) <= Number(p.lowStockThreshold || 10)
  );

  if (byId("alertCount")) {
    byId("alertCount").textContent = `${alerts.length} alerts`;
  }

  list.innerHTML = alerts.map(p => `
    <div class="alert-item">
      <span class="alert-item-icon">⚠</span>
      <div class="alert-info">
        <strong>${safe(p.name)}</strong>
        <small>SKU: ${safe(p.sku)}</small>
      </div>
      <div class="alert-stock">
        <strong>${stockOf(p)} left</strong>
        <small>Minimum: ${p.lowStockThreshold}</small>
      </div>
    </div>
  `).join("") || "<p>No stock alerts.</p>";
}

function renderActivities() {
  const tbody = byId("activityTableBody");
  if (!tbody) return;

  tbody.innerHTML = activities.map(a => `
    <tr>
      <td>${safe(a.title)}</td>
      <td>${safe(a.detail)}</td>
      <td>${safe(a.reference)}</td>
      <td>${safe(a.quantity)}</td>
      <td>${safe(a.status)}</td>
      <td>${safe(a.time)}</td>
    </tr>
  `).join("");
}
/* PART 2 — MODULES, PRODUCTS, STOCK & SHIPMENTS */

function ensureModule(id, title, description, content) {
  const section = byId(id);
  if (!section) return;

  if (section.dataset.moduleBuilt === "true") return;

  section.dataset.moduleBuilt = "true";
  section.innerHTML = `
    <div class="module-heading">
      <div>
        <h2>${safe(title)}</h2>
        <p>${safe(description)}</p>
      </div>
    </div>
    ${content}
  `;
}

function buildModules() {
  ensureModule("products", "Product Management",
    "Add, search, edit and manage your inventory.",
    `<div class="module-toolbar">
      <input id="productSearch" placeholder="Search products or SKU...">
      <button class="btn-primary" id="addProductBtn">+ Add Product</button>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>Product</th><th>SKU</th><th>Category</th>
      <th>Price</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody id="productsTableBody"></tbody>
    </table></div>
    <div id="productFormArea"></div>`
  );

  ensureModule("stock-management", "Stock Management",
    "Adjust stock and review inventory movement history.",
    `<form id="stockForm" class="module-form">
      <label>Product<select id="stockProduct" required></select></label>
      <label>Movement type<select id="stockType">
        <option value="in">Stock In</option>
        <option value="out">Stock Out</option>
      </select></label>
      <label>Quantity<input id="stockQuantity" type="number" min="1" required></label>
      <label>Note<input id="stockNote" placeholder="Reason for adjustment"></label>
      <button class="btn-primary" type="submit">Update Stock</button>
    </form>
    <div class="table-wrap"><table>
      <thead><tr><th>Date</th><th>Product</th><th>Type</th>
      <th>Quantity</th><th>Note</th></tr></thead>
      <tbody id="movementTableBody"></tbody>
    </table></div>`
  );

  ensureModule("incoming-shipments", "Incoming Shipments",
    "Record purchase orders and receive stock into the warehouse.",
    `<form id="incomingForm" class="module-form">
      <label>Product<select id="incomingProduct" required></select></label>
      <label>Supplier<input id="incomingSupplier" required placeholder="Supplier name"></label>
      <label>Quantity<input id="incomingQuantity" type="number" min="1" required></label>
      <label>Reference<input id="incomingReference" placeholder="PO number"></label>
      <button class="btn-primary" type="submit">Receive Shipment</button>
    </form>
    <div class="table-wrap"><table>
      <thead><tr><th>Reference</th><th>Product</th><th>Supplier</th>
      <th>Quantity</th><th>Date</th><th>Status</th></tr></thead>
      <tbody id="incomingTableBody"></tbody>
    </table></div>`
  );

  ensureModule("outgoing-shipments", "Outgoing Shipments",
    "Create outgoing orders and dispatch products.",
    `<form id="outgoingForm" class="module-form">
      <label>Product<select id="outgoingProduct" required></select></label>
      <label>Customer<input id="outgoingCustomer" required placeholder="Customer name"></label>
      <label>Quantity<input id="outgoingQuantity" type="number" min="1" required></label>
      <label>Reference<input id="outgoingReference" placeholder="Sales order number"></label>
      <button class="btn-primary" type="submit">Create Shipment</button>
    </form>
    <div class="table-wrap"><table>
      <thead><tr><th>Reference</th><th>Product</th><th>Customer</th>
      <th>Quantity</th><th>Date</th><th>Status</th><th>Action</th></tr></thead>
      <tbody id="outgoingTableBody"></tbody>
    </table></div>`
  );

  ensureModule("warehouse-locations", "Warehouse Locations",
    "Manage zones, aisles, racks, bins and storage capacity.",
    `<form id="locationForm" class="module-form">
      <label>Zone<input id="locationZone" required placeholder="A"></label>
      <label>Aisle<input id="locationAisle" required placeholder="01"></label>
      <label>Rack<input id="locationRack" required placeholder="01"></label>
      <label>Bin<input id="locationBin" required placeholder="01"></label>
      <label>Capacity<input id="locationCapacity" type="number" min="1" required></label>
      <label>Used capacity<input id="locationUsed" type="number" min="0" value="0" required></label>
      <button class="btn-primary" type="submit">Add Location</button>
    </form>
    <div class="table-wrap"><table>
      <thead><tr><th>Location</th><th>Capacity</th><th>Used</th>
      <th>Available</th><th>Utilization</th><th>Action</th></tr></thead>
      <tbody id="locationsTableBody"></tbody>
    </table></div>`
  );

  ensureModule("inventory-reports", "Inventory Reports",
    "Review inventory valuation, stock status and movements.",
    `<div class="module-toolbar">
      <button class="btn-primary" id="exportProductsBtn">Export Products CSV</button>
      <button class="btn-secondary" id="exportMovementsBtn">Export Movements CSV</button>
    </div>
    <div class="report-summary" id="reportSummary"></div>
    <div class="table-wrap"><table>
      <thead><tr><th>Product</th><th>SKU</th><th>Stock</th>
      <th>Unit Price</th><th>Total Value</th><th>Status</th></tr></thead>
      <tbody id="reportTableBody"></tbody>
    </table></div>`
  );

  ensureModule("settings", "Settings",
    "Manage demo preferences and reset sample data.",
    `<div class="settings-panel">
      <label>Warehouse name<input id="warehouseName" value="WarehousePro"></label>
      <label>Low-stock threshold<input id="defaultThreshold" type="number" min="1" value="10"></label>
      <button class="btn-primary" id="saveSettingsBtn">Save Settings</button>
      <button class="btn-secondary" id="themeToggle">Toggle Dark Mode</button>
      <button class="btn-danger" id="resetDataBtn">Reset Demo Data</button>
    </div>`
  );
}

function renderProductOptions() {
  ["stockProduct", "incomingProduct", "outgoingProduct"].forEach(id => {
    const select = byId(id);
    if (!select) return;

    const previous = select.value;
    select.innerHTML = products.map(p =>
      `<option value="${safe(p.id)}">${safe(p.name)} (${stockOf(p)} in stock)</option>`
    ).join("");

    if (products.some(p => p.id === previous)) select.value = previous;
  });
}

function renderProducts(filter = "") {
  const tbody = byId("productsTableBody");
  if (!tbody) return;

  const query = filter.trim().toLowerCase();
  const rows = products.filter(p =>
    `${p.name} ${p.sku} ${p.category}`.toLowerCase().includes(query)
  );

  tbody.innerHTML = rows.map(p => {
    const status = stockStatus(p);
    return `<tr>
      <td><strong>${safe(p.name)}</strong></td>
      <td>${safe(p.sku)}</td>
      <td>${safe(p.category)}</td>
      <td>${money(p.price)}</td>
      <td>${stockOf(p)}</td>
      <td><span class="status-badge">${safe(status)}</span></td>
      <td>
        <button class="btn-small" data-edit-product="${safe(p.id)}">Edit</button>
        <button class="btn-small btn-danger" data-delete-product="${safe(p.id)}">Delete</button>
      </td>
    </tr>`;
  }).join("") || `<tr><td colspan="7">No products found.</td></tr>`;
}

function showProductForm(product = null) {
  const area = byId("productFormArea");
  if (!area) return;

  const p = product || {
    id: "",
    name: "",
    sku: "",
    category: "Electronics",
    price: "",
    stock: "",
    lowStockThreshold: 10,
    location: ""
  };

  area.innerHTML = `
    <form id="productForm" class="module-form">
      <h3>${product ? "Edit Product" : "Add New Product"}</h3>
      <label>Product Name<input name="name" required value="${safe(p.name)}"></label>
      <label>SKU<input name="sku" required value="${safe(p.sku)}"></label>
      <label>Category<input name="category" required value="${safe(p.category)}"></label>
      <label>Unit Price<input name="price" type="number" min="0" step="0.01" required value="${safe(p.price)}"></label>
      <label>Stock Quantity<input name="stock" type="number" min="0" required value="${safe(p.stock)}"></label>
      <label>Low Stock Threshold<input name="lowStockThreshold" type="number" min="0" required value="${safe(p.lowStockThreshold)}"></label>
      <label>Warehouse Location<input name="location" value="${safe(p.location || "")}"></label>
      <div class="form-actions">
        <button class="btn-primary" type="submit">Save Product</button>
        <button class="btn-secondary" type="button" id="cancelProductBtn">Cancel</button>
      </div>
    </form>
  `;

  const form = byId("productForm");
  form.addEventListener("submit", event => {
    event.preventDefault();
    const data = new FormData(form);
    const sku = String(data.get("sku")).trim();

    if (products.some(item =>
      item.sku.toLowerCase() === sku.toLowerCase() && item.id !== p.id
    )) {
      toast("That SKU already exists.");
      return;
    }

    const updated = {
      id: p.id || makeId("P"),
      name: String(data.get("name")).trim(),
      sku,
      category: String(data.get("category")).trim(),
      price: Number(data.get("price")),
      stock: Number(data.get("stock")),
      lowStockThreshold: Number(data.get("lowStockThreshold")),
      location: String(data.get("location")).trim()
    };

    if (!updated.name || !updated.sku || updated.price < 0 || updated.stock < 0) {
      toast("Please enter valid product details.");
      return;
    }

    if (p.id) {
      const old = products.find(item => item.id === p.id);
      products = products.map(item => item.id === p.id ? updated : item);
      if (old && old.stock !== updated.stock) {
        recordMovement(updated, "Adjustment", updated.stock - old.stock, "Product edited");
      }
      addActivity("product", "Product updated", updated.name, updated.stock, updated.sku);
    } else {
      products.unshift(updated);
      addActivity("product", "Product added", updated.name, updated.stock, updated.sku);
    }

    persistAll();
    refreshAll();
    area.innerHTML = "";
    toast("Product saved successfully.");
  });

  const cancel = byId("cancelProductBtn");
  if (cancel) cancel.addEventListener("click", () => area.innerHTML = "");
}

function deleteProduct(id) {
  const product = products.find(p => p.id === id);
  if (!product) return;

  if (!confirm(`Delete "${product.name}"?`)) return;

  products = products.filter(p => p.id !== id);
  addActivity("product", "Product deleted", product.name, product.stock, product.sku);
  persistAll();
  refreshAll();
  toast("Product deleted.");
}

function renderMovements() {
  const tbody = byId("movementTableBody");
  if (!tbody) return;

  tbody.innerHTML = movements.map(m => `
    <tr>
      <td>${safe(m.date)}</td>
      <td>${safe(m.productName)}</td>
      <td>${safe(m.type)}</td>
      <td>${m.quantity > 0 ? "+" : ""}${safe(m.quantity)}</td>
      <td>${safe(m.note)}</td>
    </tr>
  `).join("") || `<tr><td colspan="5">No stock movements yet.</td></tr>`;
}

function setupStockForm() {
  const form = byId("stockForm");
  if (!form || form.dataset.ready) return;
  form.dataset.ready = "true";

  form.addEventListener("submit", event => {
    event.preventDefault();

    const product = products.find(p => p.id === byId("stockProduct")?.value);
    const type = byId("stockType")?.value;
    const quantity = Number(byId("stockQuantity")?.value);
    const note = byId("stockNote")?.value.trim() || "Manual stock adjustment";

    if (!product || !Number.isInteger(quantity) || quantity < 1) {
      toast("Select a product and enter a valid quantity.");
      return;
    }

    if (type === "out" && quantity > stockOf(product)) {
      toast("Not enough stock available.");
      return;
    }

    product.stock += type === "in" ? quantity : -quantity;
    recordMovement(product, type === "in" ? "Stock In" : "Stock Out",
      type === "in" ? quantity : -quantity, note);
    addActivity("stock", type === "in" ? "Stock received" : "Stock issued",
      product.name, quantity, product.sku);

    form.reset();
    refreshAll();
    toast("Stock updated successfully.");
  });
}

function renderIncoming() {
  const tbody = byId("incomingTableBody");
  if (!tbody) return;

  tbody.innerHTML = incoming.map(s => `
    <tr>
      <td>${safe(s.reference)}</td>
      <td>${safe(s.productName)}</td>
      <td>${safe(s.supplier)}</td>
      <td>${safe(s.quantity)}</td>
      <td>${safe(s.date)}</td>
      <td>${safe(s.status)}</td>
    </tr>
  `).join("") || `<tr><td colspan="6">No incoming shipments yet.</td></tr>`;
}

function setupIncomingForm() {
  const form = byId("incomingForm");
  if (!form || form.dataset.ready) return;
  form.dataset.ready = "true";

  form.addEventListener("submit", event => {
    event.preventDefault();

    const product = products.find(p => p.id === byId("incomingProduct")?.value);
    const supplier = byId("incomingSupplier")?.value.trim();
    const quantity = Number(byId("incomingQuantity")?.value);

    if (!product || !supplier || !Number.isInteger(quantity) || quantity < 1) {
      toast("Enter valid shipment details.");
      return;
    }

    const reference = byId("incomingReference")?.value.trim() || makeId("PO");

    product.stock += quantity;
    const shipment = {
      id: makeId("IN"),
      reference,
      productId: product.id,
      productName: product.name,
      supplier,
      quantity,
      date: new Date().toLocaleString("en-IN"),
      status: "Received"
    };

    incoming.unshift(shipment);
    recordMovement(product, "Shipment Received", quantity, reference);
    addActivity("incoming", "Incoming shipment received", product.name, quantity, reference);

    persistAll();
    form.reset();
    refreshAll();
    toast("Shipment received; stock updated.");
  });
}

function renderOutgoing() {
  const tbody = byId("outgoingTableBody");
  if (!tbody) return;

  tbody.innerHTML = outgoing.map(s => `
    <tr>
      <td>${safe(s.reference)}</td>
      <td>${safe(s.productName)}</td>
      <td>${safe(s.customer)}</td>
      <td>${safe(s.quantity)}</td>
      <td>${safe(s.date)}</td>
      <td>${safe(s.status)}</td>
      <td>${s.status === "Pending"
        ? `<button class="btn-small" data-dispatch="${safe(s.id)}">Dispatch</button>`
        : "—"}</td>
    </tr>
  `).join("") || `<tr><td colspan="7">No outgoing shipments yet.</td></tr>`;
}

function setupOutgoingForm() {
  const form = byId("outgoingForm");
  if (!form || form.dataset.ready) return;
  form.dataset.ready = "true";

  form.addEventListener("submit", event => {
    event.preventDefault();

    const product = products.find(p => p.id === byId("outgoingProduct")?.value);
    const customer = byId("outgoingCustomer")?.value.trim();
    const quantity = Number(byId("outgoingQuantity")?.value);

    if (!product || !customer || !Number.isInteger(quantity) || quantity < 1) {
      toast("Enter valid shipment details.");
      return;
    }

    if (quantity > stockOf(product)) {
      toast("Insufficient stock for this shipment.");
      return;
    }

    const reference = byId("outgoingReference")?.value.trim() || makeId("SO");

    outgoing.unshift({
      id: makeId("OUT"),
      reference,
      productId: product.id,
      productName: product.name,
      customer,
      quantity,
      date: new Date().toLocaleString("en-IN"),
      status: "Pending"
    });

    addActivity("outgoing", "Outgoing order created", product.name, quantity, reference);
    persistAll();
    form.reset();
    refreshAll();
    toast("Order created. Dispatch it when ready.");
  });
}

function dispatchShipment(id) {
  const shipment = outgoing.find(s => s.id === id);
  if (!shipment || shipment.status !== "Pending") return;

  const product = products.find(p => p.id === shipment.productId);
  if (!product || stockOf(product) < shipment.quantity) {
    toast("Insufficient stock. Adjust stock before dispatch.");
    return;
  }

  product.stock -= shipment.quantity;
  shipment.status = "Dispatched";
  shipment.dispatchedAt = new Date().toLocaleString("en-IN");

  recordMovement(product, "Shipment Dispatched", -shipment.quantity, shipment.reference);
  addActivity("outgoing", "Shipment dispatched", product.name,
    shipment.quantity, shipment.reference);

  persistAll();
  refreshAll();
  toast("Shipment dispatched; stock reduced.");
}
/* PART 3 — LOCATIONS, REPORTS, SETTINGS, AUTH & INITIALIZATION */

function renderLocations() {
  const tbody = byId("locationsTableBody");
  if (!tbody) return;

  tbody.innerHTML = locations.map(loc => {
    const capacity = Number(loc.capacity) || 0;
    const used = Number(loc.used) || 0;
    const percent = capacity ? Math.round(used / capacity * 100) : 0;

    return `<tr>
      <td>${safe(loc.zone)}-${safe(loc.aisle)}-${safe(loc.rack)}-${safe(loc.bin)}</td>
      <td>${capacity}</td>
      <td>${used}</td>
      <td>${Math.max(0, capacity - used)}</td>
      <td>
        <div class="capacity-bar">
          <div style="width:${Math.min(100, percent)}%"></div>
        </div>
        ${percent}%
      </td>
      <td><button class="btn-small btn-danger" data-delete-location="${safe(loc.id)}">Delete</button></td>
    </tr>`;
  }).join("") || `<tr><td colspan="6">No locations added.</td></tr>`;
}

function setupLocationForm() {
  const form = byId("locationForm");
  if (!form || form.dataset.ready) return;
  form.dataset.ready = "true";

  form.addEventListener("submit", event => {
    event.preventDefault();

    const zone = byId("locationZone").value.trim();
    const aisle = byId("locationAisle").value.trim();
    const rack = byId("locationRack").value.trim();
    const bin = byId("locationBin").value.trim();
    const capacity = Number(byId("locationCapacity").value);
    const used = Number(byId("locationUsed").value);

    if (!zone || !aisle || !rack || !bin ||
        !Number.isInteger(capacity) || capacity < 1 ||
        !Number.isInteger(used) || used < 0 || used > capacity) {
      toast("Check the location and capacity values.");
      return;
    }

    const exists = locations.some(l =>
      l.zone.toLowerCase() === zone.toLowerCase() &&
      l.aisle.toLowerCase() === aisle.toLowerCase() &&
      l.rack.toLowerCase() === rack.toLowerCase() &&
      l.bin.toLowerCase() === bin.toLowerCase()
    );

    if (exists) {
      toast("This location already exists.");
      return;
    }

    locations.push({
      id: makeId("LOC"),
      zone, aisle, rack, bin, capacity, used
    });

    saveData("warehouseProLocations", locations);
    form.reset();
    refreshAll();
    toast("Warehouse location added.");
  });
}

function deleteLocation(id) {
  locations = locations.filter(loc => loc.id !== id);
  saveData("warehouseProLocations", locations);
  renderLocations();
  toast("Location deleted.");
}

function renderReports() {
  const tbody = byId("reportTableBody");

  if (tbody) {
    tbody.innerHTML = products.map(p => `
      <tr>
        <td>${safe(p.name)}</td>
        <td>${safe(p.sku)}</td>
        <td>${stockOf(p)}</td>
        <td>${money(p.price)}</td>
        <td>${money(valueOf(p))}</td>
        <td>${safe(stockStatus(p))}</td>
      </tr>
    `).join("") || `<tr><td colspan="6">No products to report.</td></tr>`;
  }

  const summary = byId("reportSummary");
  if (summary) {
    const totalUnits = products.reduce((sum, p) => sum + stockOf(p), 0);
    const totalValue = products.reduce((sum, p) => sum + valueOf(p), 0);
    const lowCount = products.filter(
      p => stockOf(p) <= Number(p.lowStockThreshold || 10)
    ).length;

    summary.innerHTML = `
      <div class="report-card"><span>Products</span><strong>${products.length}</strong></div>
      <div class="report-card"><span>Total Units</span><strong>${totalUnits}</strong></div>
      <div class="report-card"><span>Inventory Value</span><strong>${money(totalValue)}</strong></div>
      <div class="report-card"><span>Low / Out of Stock</span><strong>${lowCount}</strong></div>
    `;
  }
}

function exportCSV(filename, rows) {
  if (!rows.length) {
    toast("There is no data to export.");
    return;
  }

  const csv = rows.map(row => row.map(value =>
    `"${String(value ?? "").replace(/"/g, '""')}"`
  ).join(",")).join("\r\n");

  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function setupSettings() {
  const saved = getData("warehouseProSettings", {
    warehouseName: "WarehousePro",
    defaultThreshold: 10
  });

  if (byId("warehouseName")) {
    byId("warehouseName").value = saved.warehouseName;
  }

  if (byId("defaultThreshold")) {
    byId("defaultThreshold").value = saved.defaultThreshold;
  }

  const saveButton = byId("saveSettingsBtn");

  if (saveButton && !saveButton.dataset.ready) {
    saveButton.dataset.ready = "true";

    saveButton.addEventListener("click", () => {
      const warehouseName = byId("warehouseName")?.value.trim();
      const defaultThreshold = Number(byId("defaultThreshold")?.value);

      if (!warehouseName || !Number.isInteger(defaultThreshold) ||
          defaultThreshold < 1) {
        toast("Enter valid settings.");
        return;
      }

      saveData("warehouseProSettings", {
        warehouseName,
        defaultThreshold
      });

      products.forEach(p => {
        if (p.lowStockThreshold == null) {
          p.lowStockThreshold = defaultThreshold;
        }
      });

      persistAll();
      refreshAll();
      toast("Settings saved.");
    });
  }

  const resetButton = byId("resetDataBtn");

  if (resetButton && !resetButton.dataset.ready) {
    resetButton.dataset.ready = "true";

    resetButton.addEventListener("click", () => {
      if (!confirm("Reset all WarehousePro demo data?")) return;

      products = defaultProducts.map(p => ({ ...p }));
      movements = [];
      incoming = [];
      outgoing = [];
      activities = [];

      locations = [
        {
          id: "LOC-01", zone: "A", aisle: "01",
          rack: "01", bin: "01", capacity: 100, used: 70
        },
        {
          id: "LOC-02", zone: "A", aisle: "01",
          rack: "01", bin: "02", capacity: 100, used: 54
        },
        {
          id: "LOC-03", zone: "B", aisle: "02",
          rack: "01", bin: "01", capacity: 80, used: 45
        }
      ];

      persistAll();
      refreshAll();
      toast("Demo data reset.");
    });
  }
}

function setupCSVButtons() {
  const productsButton = byId("exportProductsBtn");

  if (productsButton && !productsButton.dataset.ready) {
    productsButton.dataset.ready = "true";

    productsButton.addEventListener("click", () => {
      exportCSV("warehouse-products.csv", [
        ["Name", "SKU", "Category", "Price", "Stock", "Status", "Location"],
        ...products.map(p => [
          p.name, p.sku, p.category, p.price,
          p.stock, stockStatus(p), p.location
        ])
      ]);
    });
  }

  const movementsButton = byId("exportMovementsBtn");

  if (movementsButton && !movementsButton.dataset.ready) {
    movementsButton.dataset.ready = "true";

    movementsButton.addEventListener("click", () => {
      exportCSV("warehouse-stock-movements.csv", [
        ["Date", "Product", "SKU", "Type", "Quantity", "Note"],
        ...movements.map(m => [
          m.date, m.productName, m.sku,
          m.type, m.quantity, m.note
        ])
      ]);
    });
  }
}

function refreshAll() {
  persistAll();
  renderStatistics();
  renderProducts(byId("productSearch")?.value || "");
  renderProductOptions();
  renderMovements();
  renderIncoming();
  renderOutgoing();
  renderLocations();
  renderReports();
  renderMovementChart();
  renderDonutChart();
}

function setupMovementChart() {
  const period = byId("chartPeriod");
  if (period && !period.dataset.ready) {
    period.dataset.ready = "true";
    period.addEventListener("change", renderMovementChart);
  }
}

function setupProductControls() {
  const addButton = byId("addProductBtn");

  if (addButton && !addButton.dataset.ready) {
    addButton.dataset.ready = "true";
    addButton.addEventListener("click", () => showProductForm());
  }

  const search = byId("productSearch");

  if (search && !search.dataset.ready) {
    search.dataset.ready = "true";
    search.addEventListener("input", () => renderProducts(search.value));
  }
}

function setupNavigation() {
  $$("[data-section], .sidebar a[href^='#']").forEach(link => {
    if (link.dataset.navReady) return;
    link.dataset.navReady = "true";

    link.addEventListener("click", event => {
      const href = link.getAttribute("href");
      const sectionId = link.dataset.section ||
        (href && href.startsWith("#") ? href.slice(1) : "");

      const section = byId(sectionId);
      if (!section) return;

      event.preventDefault();

      $$(".page-section, main section, .content-section").forEach(el => {
        el.classList.remove("active");
      });

      section.classList.add("active");
      section.scrollIntoView({ behavior: "smooth", block: "start" });

      $$(".sidebar a, [data-section]").forEach(el => {
        el.classList.remove("active");
      });

      link.classList.add("active");
    });
  });

  const search = byId("globalSearch");

  if (search && !search.dataset.ready) {
    search.dataset.ready = "true";

    search.addEventListener("keydown", event => {
      if (event.key !== "Enter") return;

      const query = search.value.trim().toLowerCase();
      if (!query) return;

      const match = products.find(p =>
        `${p.name} ${p.sku} ${p.category}`.toLowerCase().includes(query)
      );

      if (match) {
        const section = byId("products");
        if (section) {
          section.classList.add("active");
          section.scrollIntoView({ behavior: "smooth" });
        }

        if (byId("productSearch")) {
          byId("productSearch").value = query;
          renderProducts(query);
        }
      } else {
        toast("No matching product found.");
      }
    });
  }
}

function setupTheme() {
  const savedTheme = getData("warehouseProDarkMode", false);

  if (savedTheme) document.body.classList.add("dark-mode");

  const toggleButtons = [byId("themeToggle"), byId("darkModeToggle")].filter(Boolean);

  toggleButtons.forEach(button => {
    if (button.dataset.ready) return;
    button.dataset.ready = "true";

    button.addEventListener("click", () => {
      document.body.classList.toggle("dark-mode");
      saveData(
        "warehouseProDarkMode",
        document.body.classList.contains("dark-mode")
      );
    });
  });
}

/* DEMO LOGIN / REGISTER
   This is for a front-end demo only, not secure production authentication. */

function setupAuth() {
  const authScreen = byId("authScreen");
  const authForm = byId("authForm");
  const appShell = $(".app-shell") || byId("appShell");
  const logoutButton = byId("logoutBtn");

  const showApp = () => {
    if (authScreen) authScreen.style.display = "none";
    if (appShell) appShell.style.display = "";
  };

  const showLogin = () => {
    if (authScreen) authScreen.style.display = "";
    if (appShell) appShell.style.display = "none";
  };

  const session = getData("warehouseProSession", null);

  if (session && session.email) showApp();

  const loginTab = byId("loginTab");
  const registerTab = byId("registerTab");
  let mode = "login";

  function setMode(nextMode) {
    mode = nextMode;

    if (loginTab) loginTab.classList.toggle("active", mode === "login");
    if (registerTab) registerTab.classList.toggle("active", mode === "register");

    const submit = authForm?.querySelector('[type="submit"]');
    if (submit) {
      submit.textContent = mode === "login" ? "Login" : "Create Account";
    }

    const nameField = byId("authName") ||
      authForm?.querySelector('[name="name"]');
    const nameLabel = byId("nameLabel");

    if (nameField) {
      nameField.required = mode === "register";
      nameField.hidden = mode !== "register";
    }

    if (nameLabel) nameLabel.hidden = mode !== "register";
  }

  if (loginTab) loginTab.addEventListener("click", () => setMode("login"));
  if (registerTab) registerTab.addEventListener("click", () => setMode("register"));

  if (authForm && !authForm.dataset.ready) {
    authForm.dataset.ready = "true";

    authForm.addEventListener("submit", event => {
      event.preventDefault();

      const emailField = byId("authEmail") ||
        authForm.querySelector('[name="email"]');
      const passwordField = byId("authPassword") ||
        authForm.querySelector('[name="password"]');
      const nameField = byId("authName") ||
        authForm.querySelector('[name="name"]');

      const email = emailField?.value.trim().toLowerCase();
      const password = passwordField?.value;
      const name = nameField?.value.trim() || "Warehouse User";

      if (!email || !password) {
        toast("Enter your email and password.");
        return;
      }

      let users = getData("warehouseProDemoUsers", []);

      if (mode === "register") {
        if (users.some(user => user.email === email)) {
          toast("An account with this email already exists.");
          return;
        }

        users.push({ name, email, password });
        saveData("warehouseProDemoUsers", users);
        toast("Account created. You can now log in.");
        setMode("login");
        if (passwordField) passwordField.value = "";
        return;
      }

      const user = users.find(
        item => item.email === email && item.password === password
      );

      if (!user) {
        toast("Login details not found. Register a demo account first.");
        return;
      }

      saveData("warehouseProSession", {
        name: user.name,
        email: user.email
      });

      showApp();
      toast("Welcome to WarehousePro.");
    });
  }

  if (logoutButton) {
    logoutButton.addEventListener("click", () => {
      localStorage.removeItem("warehouseProSession");
      showLogin();
      toast("Logged out.");
    });
  }

  setMode("login");
}

function setupDelegatedActions() {
  if (document.body.dataset.actionsReady) return;
  document.body.dataset.actionsReady = "true";

  document.addEventListener("click", event => {
    const edit = event.target.closest("[data-edit-product]");
    if (edit) {
      const product = products.find(p => p.id === edit.dataset.editProduct);
      if (product) showProductForm(product);
      return;
    }

    const remove = event.target.closest("[data-delete-product]");
    if (remove) {
      deleteProduct(remove.dataset.deleteProduct);
      return;
    }

    const dispatch = event.target.closest("[data-dispatch]");
    if (dispatch) {
      dispatchShipment(dispatch.dataset.dispatch);
      return;
    }

    const removeLocation = event.target.closest("[data-delete-location]");
    if (removeLocation) {
      deleteLocation(removeLocation.dataset.deleteLocation);
    }
  });
}

function initializeWarehousePro() {
  buildModules();

  setupAuth();
  setupNavigation();
  setupTheme();
  setupMovementChart();
  setupProductControls();
  setupStockForm();
  setupIncomingForm();
  setupOutgoingForm();
  setupLocationForm();
  setupSettings();
  setupCSVButtons();
  setupDelegatedActions();

  refreshAll();

  // Display a useful section if none is active.
  const sections = $$(".page-section, main section, .content-section");

  if (sections.length && !sections.some(s => s.classList.contains("active"))) {
    const dashboard = byId("dashboard") || sections[0];
    dashboard.classList.add("active");
  }

  console.log("WarehousePro initialized successfully.");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeWarehousePro);
} else {
  initializeWarehousePro();
}