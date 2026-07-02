# API Reference

Base URL (local Docker Compose): `http://localhost:8080`

All request/response bodies are JSON. All monetary values are returned as
decimal strings (e.g. `"19.99"`) to avoid floating-point precision loss.

---

## Health

### `GET /health`
Returns `{ "status": "ok" }`. Useful for container healthchecks.

---

## Categories

### `GET /categories`
Query params: `nested=true` to receive a tree (each node has a `children`
array) instead of a flat list.

### `POST /categories`
Body:
```json
{ "name": "Apparel", "description": "Clothing", "parent_id": null }
```
Returns `201` with the created category.

### `GET /categories/:id`

---

## Products

### `GET /products`
Query params: `page` (default 1), `limit` (default 20, max 100),
`category_id`, `status`.
Returns:
```json
{ "data": [ ... ], "pagination": { "page": 1, "limit": 20, "total": 5, "total_pages": 1 } }
```

### `POST /products`
Body:
```json
{ "name": "Classic Crew T-Shirt", "description": "...", "base_price": 20.00, "category_id": 2, "status": "active" }
```
Returns `201` with the created product. `400` if `name` or `base_price` is
missing/invalid.

### `GET /products/:id`
### `PUT /products/:id` / `PATCH /products/:id`
Partial update of `name`, `description`, `base_price`, `category_id`, `status`.
### `DELETE /products/:id`
Returns `204`.

---

## Variants

### `POST /products/:id/variants`
Body:
```json
{ "sku": "TSHIRT-XXL-BLK", "name_modifier": "XXL / Black", "price_adjustment": 5.00, "initial_stock": 25 }
```
Creates the variant **and** an `inventory` row initialized with
`stock_quantity = initial_stock` (default 0) and `reserved_quantity = 0`.

### `GET /products/:id/variants`
Returns each variant joined with its live `stock_quantity`,
`reserved_quantity`, and computed `available_quantity`.

---

## Dynamic Pricing

### `GET /products/:id/price`
Query params:
- `variant_id` (required)
- `quantity` (optional, default 1)
- `user_tier` (optional, e.g. `gold`, `silver`)
- `promo_code` (optional)

Example:
```
GET /products/1/price?variant_id=3&quantity=5&user_tier=gold&promo_code=SUMMER10
```

Response:
```json
{
  "product_id": 1,
  "variant_id": 3,
  "quantity": 5,
  "unit_base_price": "25.00",
  "unit_final_price": "18.87",
  "final_price": "94.35",
  "applied_discounts": [
    { "rule_id": 1, "rule_name": "Gold Tier 15% Off", "rule_type": "USER_TIER", "discount_type": "PERCENTAGE", "discount_amount": "3.75" },
    { "rule_id": 2, "rule_name": "Buy 5+ Save 10%", "rule_type": "BULK", "discount_type": "PERCENTAGE", "discount_amount": "2.13" },
    { "rule_id": 3, "rule_name": "SUMMER10 Promo", "rule_type": "PROMO_CODE", "discount_type": "FIXED", "discount_amount": "3.00" }
  ]
}
```

Rules are fetched from `pricing_rules`, filtered to `is_active = true` and
within their `starts_at`/`ends_at` window, then applied in ascending
`priority` order (tier discounts first, then bulk, then promo codes, by
default seed data). See the README's "Pricing Engine" section for the full
strategy-pattern explanation.

---

## Pricing Rules (admin)

### `GET /pricing-rules`
### `POST /pricing-rules`
Body:
```json
{
  "name": "Gold Tier 15% Off",
  "rule_type": "USER_TIER",
  "priority": 10,
  "discount_type": "PERCENTAGE",
  "discount_value": 15.0,
  "condition_payload": { "tier": "gold" },
  "is_active": true
}
```
`rule_type` ∈ `USER_TIER | BULK | PROMO_CODE | SEASONAL`.
`discount_type` ∈ `PERCENTAGE | FIXED`.
`condition_payload` shape depends on `rule_type`:
- `USER_TIER`: `{ "tier": "gold" }`
- `BULK`: `{ "min_quantity": 5 }`
- `PROMO_CODE`: `{ "code": "SUMMER10" }`
- `SEASONAL`: date-gated only via `starts_at`/`ends_at`.

---

## Cart & Checkout

### `POST /cart`
Body (optional): `{ "user_id": "user-123" }`. Creates an empty cart.
Returns `201` with the cart row. You may also omit this call entirely —
`POST /cart/items` will create a cart implicitly if `cart_id` is not given.

### `GET /cart/:id`
Returns the cart with its `items`, including each item's `snapshotted_price`
(never a freshly recomputed price) and `reservation_expires_at`.

### `POST /cart/items`
Body:
```json
{ "cart_id": 1, "variant_id": 3, "quantity": 2, "user_tier": "gold", "promo_code": "SUMMER10" }
```
`cart_id` is optional (a new cart is created if omitted). `user_tier` /
`promo_code` are optional and are used to compute the snapshotted price at
add-to-cart time.

- **`201 Created`** — inventory reserved, price snapshotted, 15-minute (configurable)
  reservation timer started (or refreshed, if the item already existed in
  the cart — the `quantity` field represents the item's total desired
  quantity, not a delta).
- **`409 Conflict`** — `quantity` requested exceeds `available_quantity`
  (`stock_quantity - reserved_quantity`) for that variant.

Internally this endpoint runs inside a single DB transaction using
`SELECT ... FOR UPDATE` on the `inventory` row to make the
read-check-write sequence atomic under concurrency (see README).

### `POST /cart/checkout`
Body: `{ "cart_id": 1 }` (or `POST /cart/:id/checkout` with no body).

- Validates every item's `reservation_expires_at` has not passed.
- Permanently deducts `stock_quantity` and decrements `reserved_quantity`
  for each item, in one transaction, using row locks.
- Clears the cart's items and marks the cart `checked_out`.
- Returns the order summary and `order_total`.

`400` if the cart is empty. `409` if the cart isn't `active` or any
reservation has expired.

---

## Error format

All errors are JSON:
```json
{ "error": "human readable message", "details": { "...": "optional structured context" } }
```
Status codes used: `400` (validation), `404` (not found), `409` (conflict —
insufficient inventory, expired reservation, etc.), `500` (unexpected).
