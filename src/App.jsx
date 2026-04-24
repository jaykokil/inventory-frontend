
import React, { useEffect, useMemo, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

function getStoredUser() {
  try { return JSON.parse(localStorage.getItem("inventory_user") || "null"); } catch { return null; }
}

async function apiRequest(path, options = {}) {
  const token = localStorage.getItem("token");
  let response;
  try {
    response = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {})
      }
    });
  } catch {
    throw new Error("Backend not reachable. Check backend URL / VITE_API_URL.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || `Server error: ${response.status}`);
  return data;
}

function Button({ children, variant = "primary", ...props }) {
  return <button className={`btn ${variant}`} {...props}>{children}</button>;
}
function Card({ children, className = "" }) {
  return <div className={`card ${className}`}>{children}</div>;
}
function SelectBox({ value, onChange, children, disabled }) {
  return <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>{children}</select>;
}
function StatCard({ title, value, sub, icon }) {
  return <Card><div className="stat"><div><p className="muted">{title}</p><h2>{value}</h2>{sub && <p className="small">{sub}</p>}</div><div className="statIcon">{icon}</div></div></Card>;
}

function InventoryReading({ disabled, row }) {
  const active = !!row;
  return (
    <div className={`reading ${disabled ? "disabled" : ""}`}>
      <div className="readingTop">
        <div>
          <p className="muted">Bottle Reading Result</p>
          <h2>{active ? row.name : "-//-"}</h2>
          <p className="muted">{active ? `${row.category} • ${row.bottleSize} ML` : "-"}</p>
        </div>
        <div className="readingRight">
          <Button variant="secondary">Read Again</Button>
          <div className="currentReading">
            <p className="muted">Current Reading</p>
            <p className="small">REMAINING</p>
            <h2>{active ? `${row.closingOpenBottleRemainingMl || 0} ML` : "--/--"}</h2>
          </div>
        </div>
      </div>
      <div className="readingGrid">
        <div className="mini"><p>OPENING FULL BOTTLES</p><h2>{active ? row.openingFullBottleCount : "-"}</h2></div>
        <div className="mini"><p>OPENING OPEN BOTTLE ML</p><h2>{active ? row.openingOpenBottleRemainingMl : "-"}</h2></div>
        <div className="mini"><p>CLOSING FULL BOTTLES</p><h2>{active ? row.closingFullBottleCount : "-"}</h2></div>
        <div className="mini"><p>CLOSING EMPTY BOTTLES</p><h2>{active ? "1" : "-"}</h2></div>
        <div className="mini wide"><p>CLOSING OPEN BOTTLE ML</p><h2>{active ? row.closingOpenBottleRemainingMl : "-"}</h2></div>
      </div>
      <div className="rowButtons">
        <Button>Save Closing</Button>
        <Button variant="secondary">Read Next Bottle</Button>
        <Button variant="secondary">Update Indent</Button>
      </div>
    </div>
  );
}

function Login({ onLogin }) {
  const [username, setUsername] = useState("skyline");
  const [password, setPassword] = useState("1234");
  const [message, setMessage] = useState("Use skyline / 1234");

  async function submit(e) {
    e.preventDefault();
    const result = await onLogin(username.trim(), password.trim());
    if (!result.ok) setMessage(result.message || "Login failed");
  }

  return (
    <div className="loginPage">
      <div className="hero">
        <span className="pill">Inventory Platform</span>
        <h1>Outlet-first hospitality inventory system</h1>
        <p>Live frontend connected to backend for outlet, bar, stock room, transfer and closing inventory.</p>
      </div>
      <Card className="loginCard">
        <h2>Login</h2>
        <p className="muted">User-side login</p>
        <form onSubmit={submit}>
          <div className="field"><label>Username</label><input value={username} onChange={(e) => setUsername(e.target.value)} /></div>
          <div className="field"><label>Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <Button type="submit">Continue</Button>
        </form>
        <div className="note">{message}</div>
      </Card>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);

  async function login(username, password) {
    try {
      const result = await apiRequest("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
      localStorage.setItem("token", result.token);
      localStorage.setItem("inventory_user", JSON.stringify(result.user));
      setSession({ type: "user", userId: result.user.id });
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error.message };
    }
  }
  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("inventory_user");
    setSession(null);
  }
  useEffect(() => {
    const token = localStorage.getItem("token");
    const user = getStoredUser();
    if (token && user) setSession({ type: "user", userId: user.id });
  }, []);

  if (!session) return <Login onLogin={login} />;
  return <Dashboard onLogout={logout} />;
}

function Dashboard({ onLogout }) {
  const [page, setPage] = useState("dashboard");
  const [outlets, setOutlets] = useState([]);
  const [bars, setBars] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedOutletId, setSelectedOutletId] = useState("");
  const [selectedBarId, setSelectedBarId] = useState("");
  const [selectedStockRoomId, setSelectedStockRoomId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [manualSearch, setManualSearch] = useState("");
  const [manualRemainingMl, setManualRemainingMl] = useState("");
  const [fullCount, setFullCount] = useState("");
  const [openMl, setOpenMl] = useState("");
  const [transferFromBarId, setTransferFromBarId] = useState("");
  const [transferToBarId, setTransferToBarId] = useState("");
  const [closingSession, setClosingSession] = useState(null);
  const [closingFullBottle, setClosingFullBottle] = useState("");
  const [closingOpenBottleMl, setClosingOpenBottleMl] = useState("");
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("");
  const [history, setHistory] = useState([]);

  const storedUser = getStoredUser();
  const currentUserName = storedUser?.businessName || storedUser?.name || "Inventory User";
  const currentOwnerName = storedUser?.ownerName || storedUser?.username || "";

  const selectedBar = bars.find((b) => b.id === selectedBarId);
  const stockRooms = bars.filter((b) => String(b.type || "").includes("stock"));
  const normalBars = bars.filter((b) => !String(b.type || "").includes("stock"));
  const isStockRoom = String(selectedBar?.type || "").includes("stock");
  const activeRows = rows.filter((r) => r.outletId === selectedOutletId && r.barId === selectedBarId);
  const latestRow = activeRows[0];

  const productResults = useMemo(() => {
    const q = manualSearch.toLowerCase().trim();
    if (!q) return [];
    return products.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.productCode.toLowerCase().includes(q)
    );
  }, [products, manualSearch]);

  useEffect(() => {
    apiRequest("/outlets").then(setOutlets).catch((e) => setStatus(e.message));
    apiRequest("/products").then(setProducts).catch((e) => setStatus(e.message));
  }, []);

  useEffect(() => {
    if (!selectedOutletId) {
      setBars([]);
      setSelectedBarId("");
      return;
    }
    apiRequest(`/bars/outlet/${selectedOutletId}`)
      .then((data) => {
        setBars(data);
        const firstStock = data.find((b) => String(b.type || "").includes("stock"));
        if (firstStock) setSelectedStockRoomId(firstStock.id);
      })
      .catch((e) => setStatus(e.message));
  }, [selectedOutletId]);

  function upsertRow(row) {
    setRows((prev) => {
      const existing = prev.findIndex((r) => r.barId === row.barId && r.productCode === row.productCode);
      if (existing >= 0) {
        const copy = [...prev];
        copy[existing] = row;
        return copy;
      }
      return [row, ...prev];
    });
  }

  function rowFromInventory(entry, product) {
    return {
      id: entry.id,
      outletId: selectedOutletId,
      barId: selectedBarId,
      productCode: product.productCode,
      name: product.name,
      category: product.category,
      bottleSize: product.bottleSizeMl,
      costOfBottle: product.costOfBottle,
      openingFullBottleCount: entry.openingFullBottle || 0,
      openingOpenBottleRemainingMl: entry.openingOpenBottleMl || entry.openingOpenBottle || 0,
      indent: entry.indentFullBottle || entry.indent || 0,
      transfer: entry.transferFullBottle || entry.transfer || 0,
      closingFullBottleCount: entry.closingFullBottle || 0,
      closingOpenBottleRemainingMl: entry.closingOpenBottleMl || entry.closingOpenBottle || 0,
      consumption: entry.consumptionMl || entry.totalConsumption || 0,
      totalSell: entry.totalSell || 0
    };
  }

  async function applyManualInventory() {
    if (!selectedBarId || !selectedProductId || !manualRemainingMl) return setStatus("Select bar, product and remaining ML first.");
    try {
      const product = products.find((p) => p.id === selectedProductId);
      const entry = await apiRequest("/inventory/manual-entry", {
        method: "POST",
        body: JSON.stringify({
          barId: selectedBarId,
          productId: selectedProductId,
          remainingMl: Number(manualRemainingMl),
          businessDate: new Date().toISOString()
        })
      });
      upsertRow(rowFromInventory(entry, product));
      setManualRemainingMl("");
      setStatus("Manual inventory saved.");
    } catch (e) {
      setStatus(e.message);
    }
  }

  async function assignStock() {
    if (!selectedOutletId || !selectedStockRoomId || !selectedBarId || !selectedProductId) return setStatus("Select outlet, stock room, bar and product.");
    try {
      await apiRequest("/stock-room/assign", {
        method: "POST",
        body: JSON.stringify({
          outletId: selectedOutletId,
          stockRoomBarId: selectedStockRoomId,
          destinationBarId: selectedBarId,
          productId: selectedProductId,
          fullBottleCount: Number(fullCount || 0),
          openBottleMl: Number(openMl || 0)
        })
      });
      setFullCount("");
      setOpenMl("");
      setStatus("Stock assigned successfully.");
    } catch (e) {
      setStatus(e.message);
    }
  }

  async function transferStock() {
    if (!selectedOutletId || !transferFromBarId || !transferToBarId || !selectedProductId) return setStatus("Select from bar, to bar and product.");
    try {
      await apiRequest("/transfers", {
        method: "POST",
        body: JSON.stringify({
          outletId: selectedOutletId,
          fromBarId: transferFromBarId,
          toBarId: transferToBarId,
          productId: selectedProductId,
          fullBottleCount: Number(fullCount || 0),
          openBottleMl: Number(openMl || 0)
        })
      });
      setStatus("Transfer completed successfully.");
      setFullCount("");
      setOpenMl("");
    } catch (e) {
      setStatus(e.message);
    }
  }

  async function startClosing() {
    if (!selectedOutletId || !selectedBarId) return setStatus("Select outlet and bar first.");
    try {
      const session = await apiRequest("/closing/session", {
        method: "POST",
        body: JSON.stringify({ outletId: selectedOutletId, barId: selectedBarId })
      });
      setClosingSession(session);
      setStatus("Closing session started.");
    } catch (e) {
      setStatus(e.message);
    }
  }

  async function saveClosingItem() {
    if (!closingSession || !selectedBarId || !selectedProductId) return setStatus("Start closing and select product.");
    try {
      const product = products.find((p) => p.id === selectedProductId);
      const item = await apiRequest("/closing/item", {
        method: "POST",
        body: JSON.stringify({
          sessionId: closingSession.id,
          barId: selectedBarId,
          productId: selectedProductId,
          closingFullBottle: Number(closingFullBottle || 0),
          closingOpenBottleMl: Number(closingOpenBottleMl || 0)
        })
      });
      upsertRow(rowFromInventory(item, product));
      setClosingFullBottle("");
      setClosingOpenBottleMl("");
      setStatus(`Closing saved. Consumption: ${item.consumptionMl} ML.`);
    } catch (e) {
      setStatus(e.message);
    }
  }

  async function completeClosing() {
    if (!closingSession) return setStatus("No closing session active.");
    try {
      await apiRequest(`/closing/session/${closingSession.id}/complete`, { method: "POST" });
      setClosingSession(null);
      setStatus("Closing completed.");
    } catch (e) {
      setStatus(e.message);
    }
  }

  async function loadHistory() {
    try {
      const data = await apiRequest("/history");
      setHistory(data);
      setStatus("History loaded.");
    } catch (e) {
      setStatus(e.message);
    }
  }

  function exportCsv() {
    const header = isStockRoom
      ? ["Product ID", "Name", "Category", "Bottle size", "Cost of Bottle", "Total Full Bottle", "Total Open Bottle", "Stock Value"]
      : ["Product ID", "Name", "Category", "Bottle size", "Cost of Bottle", "Opening full Bottle", "Opening open Bottle", "Indent", "Transfer", "Closing full Bottle", "Closing open Bottle", "Total Consumption", "Total Sell"];
    const body = activeRows.map((r) => isStockRoom
      ? [r.productCode, r.name, r.category, r.bottleSize, r.costOfBottle, r.closingFullBottleCount || r.openingFullBottleCount, r.closingOpenBottleRemainingMl || r.openingOpenBottleRemainingMl, (r.closingFullBottleCount || r.openingFullBottleCount) * r.costOfBottle]
      : [r.productCode, r.name, r.category, r.bottleSize, r.costOfBottle, r.openingFullBottleCount, r.openingOpenBottleRemainingMl, r.indent, r.transfer, r.closingFullBottleCount, r.closingOpenBottleRemainingMl, r.consumption, r.totalSell]
    );
    const csv = [header, ...body].map((row) => row.join(",")).join("\\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "inventory_export.csv";
    link.click();
  }

  return (
    <div className="app">
      <header>
        <div>
          <p className="muted">User Interface</p>
          <h1>{currentUserName}</h1>
          <p className="muted">{currentOwnerName}</p>
        </div>
        <nav>
          {["dashboard", "outlet", "report", "history"].map((item) => (
            <Button key={item} variant={page === item ? "primary" : "secondary"} onClick={() => setPage(item)}>{item}</Button>
          ))}
          <Button variant="secondary" onClick={onLogout}>Logout</Button>
        </nav>
      </header>

      <main>
        {status ? <div className="alert">{status}</div> : null}

        {page === "dashboard" && (
          <>
            <section className="stats">
              <StatCard title="Restaurant / Bar" value={currentUserName} sub={currentOwnerName} icon="🏢" />
              <StatCard title="Device Status" value="Disconnected" sub="scanner + scale" icon="📡" />
              <Card className="connectCard"><Button>Connect Device</Button></Card>
            </section>

            <Card>
              <div className="cardHead">
                <div>
                  <h2>Inventory</h2>
                  <p className="muted">Select outlet and bar to take inventory, assign stock, transfer stock, or close the day.</p>
                </div>
              </div>

              <div className="filters">
                <SelectBox value={selectedOutletId} onChange={(value) => { setSelectedOutletId(value); setSelectedBarId(""); }}>
                  <option value="">Select outlet</option>
                  {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </SelectBox>

                <SelectBox value={selectedBarId} onChange={setSelectedBarId} disabled={!selectedOutletId}>
                  <option value="">Select bar or stock room</option>
                  {bars.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </SelectBox>
              </div>

              <InventoryReading disabled={!selectedOutletId || !selectedBarId} row={latestRow} />

              {selectedOutletId && selectedBarId ? (
                <>
                  <Card className="innerCard">
                    <div className="manualGrid">
                      <div>
                        <input placeholder="Search bottle name manually" value={manualSearch} onChange={(e) => setManualSearch(e.target.value)} />
                        {productResults.length > 0 && (
                          <div className="suggestions">
                            {productResults.slice(0, 5).map((p) => (
                              <button key={p.id} onClick={() => { setSelectedProductId(p.id); setManualSearch(p.name); }}>
                                <b>{p.name}</b><span>{p.category} • {p.bottleSizeMl} ML</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <input placeholder="Enter remaining ml" value={manualRemainingMl} onChange={(e) => setManualRemainingMl(e.target.value)} />
                      <Button onClick={applyManualInventory}>Apply Manual Inventory</Button>
                    </div>
                  </Card>

                  <section className="threeGrid">
                    <Card>
                      <h3>🏬 Assign From Stock Room</h3>
                      <p className="muted">Move stock from stock room to selected bar.</p>
                      <SelectBox value={selectedStockRoomId} onChange={setSelectedStockRoomId}>
                        <option value="">Select stock room</option>
                        {stockRooms.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </SelectBox>
                      <SelectBox value={selectedProductId} onChange={setSelectedProductId}>
                        <option value="">Select product</option>
                        {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </SelectBox>
                      <input placeholder="Full bottle count" value={fullCount} onChange={(e) => setFullCount(e.target.value)} />
                      <input placeholder="Open bottle ML" value={openMl} onChange={(e) => setOpenMl(e.target.value)} />
                      <Button onClick={assignStock}>Assign Stock</Button>
                    </Card>

                    <Card>
                      <h3>⇄ Transfer Stock</h3>
                      <p className="muted">Transfer stock from one bar to another.</p>
                      <SelectBox value={transferFromBarId} onChange={setTransferFromBarId}>
                        <option value="">From bar</option>
                        {normalBars.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </SelectBox>
                      <SelectBox value={transferToBarId} onChange={setTransferToBarId}>
                        <option value="">To bar</option>
                        {normalBars.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </SelectBox>
                      <SelectBox value={selectedProductId} onChange={setSelectedProductId}>
                        <option value="">Select product</option>
                        {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </SelectBox>
                      <input placeholder="Full bottle count" value={fullCount} onChange={(e) => setFullCount(e.target.value)} />
                      <input placeholder="Open bottle ML" value={openMl} onChange={(e) => setOpenMl(e.target.value)} />
                      <Button onClick={transferStock}>Transfer</Button>
                    </Card>

                    <Card>
                      <h3>✅ Closing Session</h3>
                      <p className="muted">Calculate consumption using closing stock.</p>
                      <Button variant={closingSession ? "secondary" : "primary"} onClick={startClosing}>{closingSession ? "Closing Started" : "Start Closing"}</Button>
                      <SelectBox value={selectedProductId} onChange={setSelectedProductId}>
                        <option value="">Select product</option>
                        {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </SelectBox>
                      <input placeholder="Closing full bottle count" value={closingFullBottle} onChange={(e) => setClosingFullBottle(e.target.value)} />
                      <input placeholder="Closing open bottle ML" value={closingOpenBottleMl} onChange={(e) => setClosingOpenBottleMl(e.target.value)} />
                      <Button onClick={saveClosingItem} disabled={!closingSession}>Save Closing Item</Button>
                      <Button variant="secondary" onClick={completeClosing} disabled={!closingSession}>Complete Closing</Button>
                    </Card>
                  </section>
                </>
              ) : null}
            </Card>
          </>
        )}

        {page === "outlet" && (
          <div>
            <h2>Outlets</h2>
            <p className="muted">Outlet cards show bar and stock room details.</p>
            <div className="outletGrid">
              {outlets.map((outlet) => (
                <Card key={outlet.id}>
                  <h3>{outlet.name}</h3>
                  <p className="muted">{outlet.address || "-"}</p>
                  <div className="barList">
                    {bars.filter((b) => b.outletId === outlet.id).map((b) => (
                      <div key={b.id} className="barItem">
                        <b>{b.name}</b>
                        <span>{b.type || "bar"} • {b.location || "-"}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {page === "report" && (
          <Card>
            <h2>Report</h2>
            <div className="filters">
              <SelectBox value={selectedOutletId} onChange={setSelectedOutletId}>
                <option value="">Select outlet</option>
                {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </SelectBox>
              <SelectBox value={selectedBarId} onChange={setSelectedBarId}>
                <option value="">Select bar</option>
                {bars.filter((b) => b.outletId === selectedOutletId).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </SelectBox>
              <Button onClick={exportCsv}>Export Inventory</Button>
            </div>

            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>Product ID</th><th>Name</th><th>Category</th><th>Bottle size</th><th>Cost</th>
                    {!isStockRoom && <><th>Opening Full</th><th>Opening Open</th><th>Indent</th><th>Transfer</th><th>Closing Full</th><th>Closing Open</th><th>Consumption</th><th>Total Sell</th></>}
                    {isStockRoom && <><th>Total Full</th><th>Total Open</th><th>Stock Value</th></>}
                  </tr>
                </thead>
                <tbody>
                  {activeRows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.productCode}</td><td>{r.name}</td><td>{r.category}</td><td>{r.bottleSize}</td><td>{r.costOfBottle}</td>
                      {!isStockRoom && <><td>{r.openingFullBottleCount}</td><td>{r.openingOpenBottleRemainingMl}</td><td>{r.indent}</td><td>{r.transfer}</td><td>{r.closingFullBottleCount}</td><td>{r.closingOpenBottleRemainingMl}</td><td>{r.consumption}</td><td>{r.totalSell}</td></>}
                      {isStockRoom && <><td>{r.closingFullBottleCount || r.openingFullBottleCount}</td><td>{r.closingOpenBottleRemainingMl || r.openingOpenBottleRemainingMl}</td><td>{(r.closingFullBottleCount || r.openingFullBottleCount) * r.costOfBottle}</td></>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {page === "history" && (
          <Card>
            <div className="cardHead">
              <div><h2>History</h2><p className="muted">Activity logs from backend.</p></div>
              <Button onClick={loadHistory}>Load History</Button>
            </div>
            <div className="history">
              {history.map((h) => (
                <div className="historyItem" key={h.id}>
                  <b>{h.action}</b>
                  <span>{h.message}</span>
                  <small>{h.createdAt}</small>
                </div>
              ))}
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}
