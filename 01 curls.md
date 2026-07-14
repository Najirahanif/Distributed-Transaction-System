Now that all three services are running, test the **Happy Path** step by step. Don't jump directly to the end—verify each stage.

---

# Step 1: Verify the services are running

## Order Service

```bash
curl http://localhost:3001/
```

---

## Inventory Service

```bash
curl http://localhost:3002/
```

---

## Payment Service

```bash
curl http://localhost:3003/
```

All three should return a success message.

---

# Step 2: Create a Product

```bash
curl --location 'http://localhost:3002/inventory/products' \
--header 'Content-Type: application/json' \
--data '{
    "productId": "P1001",
    "productName": "Laptop",
    "stock": 10
}'
```

Expected Response

```json
{
    "success": true,
    "message": "Product created successfully."
}
```

---

# Step 3: Verify Product

```bash
curl http://localhost:3002/inventory/products
```

Expected

```json
[
    {
        "productId": "P1001",
        "productName": "Laptop",
        "stock": 10
    }
]
```

---

# Step 4: Create an Order

```bash
curl --location 'http://localhost:3001/orders' \
--header 'Content-Type: application/json' \
--data '{
    "productId": "P1001",
    "quantity": 2,
    "amount": 5000
}'
```

Expected Response

```json
{
    "success": true,
    "message": "Order created successfully.",
    "data": {
        "_id": "...",
        "status": "PENDING"
    }
}
```

---

# Step 5: Watch the Order Service Logs

You should see something like:

```text
MongoDB Transaction Started

Order Created

Order Audit Created

Transaction Committed

Published order-created
```

---

# Step 6: Watch the Inventory Service Logs

You should see:

```text
📦 Order Received

{
   orderId: "...",
   productId: "P1001",
   quantity: 2,
   amount: 5000
}

Inventory Reserved

Inventory Log Created

Transaction Committed

Published inventory-reserved
```

---

# Step 7: Verify Inventory

```bash
curl http://localhost:3002/inventory/products
```

Expected

```json
[
    {
        "productId": "P1001",
        "stock": 8
    }
]
```

The stock should decrease from **10** to **8**.

---

# Step 8: Check Inventory Logs

```bash
curl http://localhost:3002/inventory/logs
```

Expected

```json
[
    {
        "action": "STOCK_RESERVED",
        "quantity": 2
    }
]
```

---

# Step 9: Watch the Payment Service Logs

Expected

```text
Inventory Reserved Event Received

Payment Created

Payment Audit Created

Transaction Committed

Published payment-success
```

or, if your random failure simulation triggers:

```text
Published payment-failed
```

---

# Step 10: Check Payments

```bash
curl http://localhost:3003/payments
```

Expected

```json
[
    {
        "orderId": "...",
        "amount": 5000,
        "status": "SUCCESS"
    }
]
```

---

# Step 11: Check Payment Audit

```bash
curl http://localhost:3003/payments/audits
```

Expected

```json
[
    {
        "action": "PAYMENT_SUCCESS"
    }
]
```

---

# Step 12: Verify Order Status

If you've implemented an Order Service consumer for the `payment-success` event, check the order:

```bash
curl http://localhost:3001/orders
```

Expected

```json
[
    {
        "productId": "P1001",
        "status": "CONFIRMED"
    }
]
```

---

# Happy Path Summary

```text
Create Product
        │
        ▼
POST /inventory/products
        │
        ▼
Stock = 10
        │
        ▼
POST /orders
        │
        ▼
Order Service
        │
 Publish order-created
        │
        ▼
Inventory Service
        │
 Reserve Stock
        │
 Publish inventory-reserved
        │
        ▼
Payment Service
        │
 Process Payment
        │
 Publish payment-success
        │
        ▼
Order Service
        │
 Update Status = CONFIRMED
```

## Before you test

Make sure you've implemented these consumers:

* ✅ Inventory Service consumes `order-created`.
* ✅ Payment Service consumes `inventory-reserved`.
* ✅ Order Service consumes `payment-success` and `payment-failed`.

Without the last consumer in the Order Service, the order will remain in the `PENDING` state even if the payment succeeds, because nothing is listening for the payment events to update the order status.
