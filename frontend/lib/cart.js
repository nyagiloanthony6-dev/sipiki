"use client";
// ============================================================================
// The shopping cart. Kept in the browser (localStorage), so it survives moving between
// the shop and a product page and closing the tab. Each line keeps a small snapshot of
// the product (name, price, photo) so the cart can be drawn from any page. The server
// always re-reads the real price and stock when the order is placed.
// ============================================================================
import { useCallback, useEffect, useMemo, useState } from "react";

const KEY = "sipiki_cart_v1";
const MAX_LINES = 20;
const MAX_QTY = 50;

/** One cart line = one product in one size/colour. */
export const lineKey = (l) => `${l.productId}:${l.variantId || ""}`;

const valid = (l) => l && typeof l.productId === "string" && Number.isInteger(l.quantity) && l.quantity > 0 && typeof l.title === "string" && Number.isFinite(l.price);

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(raw) ? raw.filter(valid).slice(0, MAX_LINES) : [];
  } catch {
    return [];
  }
}

export function useCart() {
  const [lines, setLines] = useState([]);

  useEffect(() => {
    setLines(read());
    const onStorage = (e) => { if (e.key === KEY) setLines(read()); }; // another tab changed the cart
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const commit = useCallback((fn) => {
    setLines((prev) => {
      const next = fn(prev);
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage blocked: the cart lasts until the page closes */ }
      return next;
    });
  }, []);

  const add = useCallback((product, quantity = 1) => commit((prev) => {
    const key = `${product.id}:${product.variantId || ""}`;
    const cap = Math.min(MAX_QTY, product.stock > 0 ? product.stock : MAX_QTY); // never offer more than the shop has
    const found = prev.find((l) => lineKey(l) === key);
    if (found) return prev.map((l) => (lineKey(l) === key ? { ...l, stock: product.stock ?? l.stock, quantity: Math.min(cap, l.quantity + quantity) } : l));
    if (prev.length >= MAX_LINES) return prev;
    return [...prev, {
      productId: product.id, variantId: product.variantId || null, variantLabel: product.variantLabel || "", stock: product.stock || 0,
      quantity: Math.min(cap, quantity), title: product.title, price: product.price,
      image: product.image || null, vendor: product.vendor || "", slug: product.slug || null, emoji: product.emoji || null,
    }];
  }), [commit]);

  const setQuantity = useCallback((key, quantity) => commit((prev) =>
    quantity <= 0 ? prev.filter((l) => lineKey(l) !== key)
      : prev.map((l) => (lineKey(l) === key ? { ...l, quantity: Math.min(MAX_QTY, l.stock > 0 ? l.stock : MAX_QTY, quantity) } : l))), [commit]);

  // The server names products (not lines) it can no longer sell, so every size/colour of them goes
  const removeMany = useCallback((productIds) => commit((prev) => prev.filter((l) => !productIds.includes(l.productId))), [commit]);
  const clear = useCallback(() => commit(() => []), [commit]);

  const count = useMemo(() => lines.reduce((s, l) => s + l.quantity, 0), [lines]);
  const subtotal = useMemo(() => lines.reduce((s, l) => s + l.price * l.quantity, 0), [lines]);
  return { lines, count, subtotal, add, setQuantity, removeMany, clear };
}
