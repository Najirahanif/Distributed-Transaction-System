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