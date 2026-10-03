import React, { useEffect, useMemo, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:8080/api";
const DELIVERY_FEE = 30;
const TAX_RATE = 0.05;

export default function App() {
  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [vegOnly, setVegOnly] = useState(false);
  const [cart, setCart] = useState(() => {
    try { return JSON.parse(localStorage.getItem("foodie-cart")) || []; } catch { return []; }
  });
  const [cartOpen, setCartOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", address: "" });
  const [errors, setErrors] = useState({});
  const [placing, setPlacing] = useState(false);
  const [receipt, setReceipt] = useState(null);

  useEffect(() => {
    fetch(`${API}/foods`)
      .then(r => r.json())
      .then(setFoods)
      .catch(() => setError("We can't reach the kitchen. Start the Java server (java FoodOrderingServer) and refresh."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    localStorage.setItem("foodie-cart", JSON.stringify(cart));
  }, [cart]);

  const categories = useMemo(() => ["All", ...new Set(foods.map(f => f.category))], [foods]);

  const visible = foods.filter(f =>
    (category === "All" || f.category === category) &&
    (!vegOnly || f.veg) &&
    f.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  const qtyOf = id => cart.find(i => i.id === id)?.qty || 0;
  const count = cart.reduce((s, i) => s + i.qty, 0);
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const tax = Math.round(subtotal * TAX_RATE);
  const total = cart.length ? subtotal + tax + DELIVERY_FEE : 0;

  function change(food, amount) {
    setCart(prev => {
      const found = prev.find(i => i.id === food.id);
      if (!found) return amount > 0 ? [...prev, { ...food, qty: 1 }] : prev;
      return prev
        .map(i => (i.id === food.id ? { ...i, qty: i.qty + amount } : i))
        .filter(i => i.qty > 0);
    });
  }

  function validate() {
    const e = {};
    if (form.name.trim().length < 2) e.name = "Enter your full name.";
    if (!/^[6-9]\d{9}$/.test(form.phone)) e.phone = "Enter a valid 10-digit mobile number.";
    if (form.address.trim().length < 5) e.address = "Enter your delivery address.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function placeOrder() {
    if (!cart.length || !validate()) return;
    setPlacing(true);
    const order = {
      customerName: form.name.trim(),
      phone: form.phone,
      address: form.address.trim(),
      items: cart.map(({ id, name, price, qty }) => ({ id, name, price, qty })),
      total
    };
    try {
      const res = await fetch(`${API}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(order)
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setReceipt({ id: data.orderId, items: cart, total, name: form.name.trim() });
      setCart([]);
      setForm({ name: "", phone: "", address: "" });
      setCartOpen(false);
    } catch {
      setErrors({ form: "Order failed. Check that the Java server is running and try again." });
    } finally {
      setPlacing(false);
    }
  }

  return (
    <>
      <header className="topbar">
        <a className="brand" href="#top">Foodie</a>
        <button className="cart-btn" onClick={() => setCartOpen(true)} aria-label={`Open cart, ${count} items`}>
          Cart <span className="count">{count}</span>
        </button>
      </header>

      <section className="hero" id="top">
        <h1>Hot food, at your door in 30 minutes.</h1>
        <p>Pick what you like, check out in a minute, and we start cooking.</p>
        <div className="search">
          <input
            type="search"
            placeholder="Search for pizza, dosa, coffee"
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Search the menu"
          />
        </div>
      </section>

      <main className="container">
        <div className="filters">
          <div className="tabs" role="tablist">
            {categories.map(c => (
              <button key={c} role="tab" aria-selected={category === c}
                className={category === c ? "tab active" : "tab"} onClick={() => setCategory(c)}>
                {c}
              </button>
            ))}
          </div>
          <label className="veg-toggle">
            <input type="checkbox" checked={vegOnly} onChange={e => setVegOnly(e.target.checked)} />
            Veg only
          </label>
        </div>

        {error && <div className="notice error">{error}</div>}
        {loading && <div className="grid">{[1,2,3,4,5,6].map(n => <div className="card skeleton" key={n} />)}</div>}

        {!loading && !error && visible.length === 0 && (
          <div className="empty">
            <h3>Nothing matches that search</h3>
            <p>Try another word, or clear the Veg only filter.</p>
          </div>
        )}

        <div className="grid">
          {visible.map(food => {
            const q = qtyOf(food.id);
            return (
              <article className="card" key={food.id}>
                <div className="card-top">
                  <span className="emoji" aria-hidden="true">{food.emoji}</span>
                  <span className={food.veg ? "dot veg" : "dot nonveg"} title={food.veg ? "Vegetarian" : "Non-vegetarian"} />
                </div>
                <h3>{food.name}</h3>
                <p className="desc">{food.description}</p>
                <div className="card-bottom">
                  <strong>₹{food.price}</strong>
                  {q === 0 ? (
                    <button className="add" onClick={() => change(food, 1)}>Add</button>
                  ) : (
                    <div className="stepper">
                      <button onClick={() => change(food, -1)} aria-label={`Remove one ${food.name}`}>−</button>
                      <span>{q}</span>
                      <button onClick={() => change(food, 1)} aria-label={`Add one ${food.name}`}>+</button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </main>

      {count > 0 && !cartOpen && (
        <button className="cart-bar" onClick={() => setCartOpen(true)}>
          <span>{count} item{count > 1 ? "s" : ""} in cart</span>
          <span>View cart · ₹{total}</span>
        </button>
      )}

      <div className={cartOpen ? "overlay show" : "overlay"} onClick={() => setCartOpen(false)} />
      <aside className={cartOpen ? "drawer open" : "drawer"} aria-label="Your cart">
        <div className="drawer-head">
          <h2>Your cart</h2>
          <button className="close" onClick={() => setCartOpen(false)} aria-label="Close cart">✕</button>
        </div>

        {cart.length === 0 ? (
          <div className="empty">
            <h3>Your cart is empty</h3>
            <p>Add a few dishes from the menu to get started.</p>
          </div>
        ) : (
          <div className="drawer-body">
            {cart.map(item => (
              <div className="line" key={item.id}>
                <span className="emoji-sm">{item.emoji}</span>
                <div className="line-info">
                  <b>{item.name}</b>
                  <small>₹{item.price} each</small>
                </div>
                <div className="stepper sm">
                  <button onClick={() => change(item, -1)} aria-label={`Remove one ${item.name}`}>−</button>
                  <span>{item.qty}</span>
                  <button onClick={() => change(item, 1)} aria-label={`Add one ${item.name}`}>+</button>
                </div>
                <strong className="line-total">₹{item.price * item.qty}</strong>
              </div>
            ))}

            <div className="bill">
              <div><span>Subtotal</span><span>₹{subtotal}</span></div>
              <div><span>GST (5%)</span><span>₹{tax}</span></div>
              <div><span>Delivery</span><span>₹{DELIVERY_FEE}</span></div>
              <div className="grand"><span>Total</span><span>₹{total}</span></div>
            </div>

            <h3 className="sub">Delivery details</h3>
            <Field label="Full name" error={errors.name}>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} autoComplete="name" />
            </Field>
            <Field label="Mobile number" error={errors.phone}>
              <input value={form.phone} inputMode="numeric" maxLength={10} autoComplete="tel"
                onChange={e => setForm({ ...form, phone: e.target.value.replace(/\D/g, "") })} />
            </Field>
            <Field label="Delivery address" error={errors.address}>
              <textarea rows={2} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
            </Field>

            {errors.form && <div className="notice error">{errors.form}</div>}
            <button className="order-btn" onClick={placeOrder} disabled={placing}>
              {placing ? "Placing order…" : `Place order · ₹${total}`}
            </button>
          </div>
        )}
      </aside>

      {receipt && (
        <div className="modal-wrap" onClick={() => setReceipt(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="check">✓</div>
            <h2>Order placed, {receipt.name.split(" ")[0]}!</h2>
            <p>Your order number is <b>#{receipt.id}</b>. The kitchen is on it.</p>
            <ul>
              {receipt.items.map(i => <li key={i.id}><span>{i.qty} × {i.name}</span><span>₹{i.price * i.qty}</span></li>)}
              <li className="grand"><span>Paid on delivery</span><span>₹{receipt.total}</span></li>
            </ul>
            <button className="order-btn" onClick={() => setReceipt(null)}>Order more</button>
          </div>
        </div>
      )}

      <footer>Foodie · College mini project built with React and Java</footer>
    </>
  );
}

function Field({ label, error, children }) {
  return (
    <label className={error ? "field has-error" : "field"}>
      <span>{label}</span>
      {children}
      {error && <em>{error}</em>}
    </label>
  );
}
