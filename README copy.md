┌─────────────────────────────────────────────────────────────────────┐
│                    HOW STATUS PROPAGATES                           │
└─────────────────────────────────────────────────────────────────────┘

STEP 1: Order created, status is null
┌─────────────────────────────────────────┐
│ pendingTransactions Map:                │
│ {                                       │
│   orderId: '123...',                    │
│   inventoryStatus: null  ◄─── Waiting  │
│ }                                       │
└─────────────────────────────────────────┘
                    │
                    ▼
STEP 2: waitForInventoryResponse starts polling (every 500ms)
┌─────────────────────────────────────────┐
│ setInterval(() => {                     │
│   const transaction = pendingTrans...;  │
│   if (transaction.inventoryStatus       │
│       === 'SUCCESS' || 'FAILED') {      │
│     resolve();                          │
│   }                                     │
│ }, 500);                                │
└─────────────────────────────────────────┘
                    │
                    ▼
STEP 3: Kafka event arrives
┌─────────────────────────────────────────┐
│ Order Service Consumer receives:        │
│ "inventory-reserved" event              │
└─────────────────────────────────────────┘
                    │
                    ▼
STEP 4: Handler updates the Map
┌─────────────────────────────────────────┐
│ handleInventoryReserved(data) {         │
│   const transaction =                   │
│     pendingTransactions.get(orderId);   │
│   transaction.inventoryStatus =         │
│     'SUCCESS';  ◄─── Status updated!    │
│ }                                       │
└─────────────────────────────────────────┘
                    │
                    ▼
STEP 5: Next poll sees the change
┌─────────────────────────────────────────┐
│ Poll #4:                                │
│ transaction.inventoryStatus ===         │
│ 'SUCCESS' → resolve('SUCCESS')          │
└─────────────────────────────────────────┘

based on the status pending transaction gets updated so that the transaction gets commited

┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         COMPLETE ORDER CREATION FLOW                               │
└─────────────────────────────────────────────────────────────────────────────────────┘

Client          Order Service          Kafka          Inventory Service    Payment Service
  │                  │                   │                    │                   │
  │  POST /orders    │                   │                    │                   │
  │─────────────────▶│                   │                    │                   │
  │                  │                   │                    │                   │
  │                  │  1. Start Mongo   │                    │                   │
  │                  │     Transaction   │                    │                   │
  │                  │                   │                    │                   │
  │                  │  2. Create Order  │                    │                   │
  │                  │     (PENDING)     │                    │                   │
  │                  │                   │                    │                   │
  │                  │  3. Create Audit  │                    │                   │
  │                  │     Log           │                    │                   │
  │                  │                   │                    │                   │
  │                  │  4. Store in      │                    │                   │
  │                  │     pendingTrans  │                    │                   │
  │                  │                   │                    │                   │
  │                  │  5. Publish       │                    │                   │
  │                  │  ────────────────▶│  order-created     │                   │
  │                  │                   │───────────────────▶│                   │
  │                  │                   │                    │                   │
  │                  │  6. Wait for      │                    │  7. Process      │
  │                  │     Inventory     │                    │  Inventory       │
  │                  │     Response      │                    │                   │
  │                  │  (Polling Map)    │                    │                   │
  │                  │                   │                    │                   │
  │                  │                   │                    │  8. Publish      │
  │                  │                   │                    │  inventory-      │
  │                  │                   │                    │  reserved/failed │
  │                  │                   │◀───────────────────│                   │
  │                  │◀──────────────────│                    │                   │
  │                  │                   │                    │                   │
  │                  │  9. Handler       │                    │                   │
  │                  │     Updates Map   │                    │                   │
  │                  │                   │                    │                   │
  │                  │  10. Poll detects │                    │                   │
  │                  │      change       │                    │                   │
  │                  │                   │                    │                   │
  │                  │  11. If SUCCESS:  │                    │                   │
  │                  │      Update to    │                    │                   │
  │                  │      INVENTORY_   │                    │                   │
  │                  │      RESERVED     │                    │                   │
  │                  │                   │                    │                   │
  │                  │  12. Wait for     │                    │                   │
  │                  │      Payment      │                    │                   │
  │                  │      Response     │                    │                   │
  │                  │  (Polling Map)    │                    │                   │
  │                  │                   │                    │                   │
  │                  │                   │                    │  13. Publish     │
  │                  │                   │                    │  inventory-      │
  │                  │                   │                    │  reserved        │
  │                  │                   │───────────────────▶│                   │
  │                  │                   │                    │                   │
  │                  │                   │                    │  14. Process     │
  │                  │                   │                    │  Payment         │
  │                  │                   │                    │                   │
  │                  │                   │                    │  15. Publish     │
  │                  │                   │                    │  payment-        │
  │                  │                   │                    │  success/failed  │
  │                  │                   │◀───────────────────│                   │
  │                  │◀──────────────────│                    │                   │
  │                  │                   │                    │                   │
  │                  │  16. Handler      │                    │                   │
  │                  │      Updates Map  │                    │                   │
  │                  │                   │                    │                   │
  │                  │  17. Poll detects │                    │                   │
  │                  │      change       │                    │                   │
  │                  │                   │                    │                   │
  │                  │  18. If SUCCESS:  │                    │                   │
  │                  │      Update to    │                    │                   │
  │                  │      PAID         │                    │                   │
  │                  │                   │                    │                   │
  │                  │  19. Commit       │                    │                   │
  │                  │      Transaction  │                    │                   │
  │                  │                   │                    │                   │
  │  Response        │                   │                    │                   │
  │◀─────────────────│                   │                    │                   │
  │                  │                   │                    │                   │
  │  20. If FAILED:  │                   │                    │                   │
  │      Abort       │                   │                    │                   │
  │      Transaction │                   │                    │                   │
  │      Return Error│                   │                    │                   │
  │                  │                   │                    │                   │