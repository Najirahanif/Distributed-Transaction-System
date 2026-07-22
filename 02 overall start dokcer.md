```bash
## single command to stop everythging and to restart 
{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}
{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}
{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}
{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}
{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}
echo "🔄 Stopping everything..."
docker-compose down -v

echo "🏗️ Rebuilding all services..."
docker-compose build --no-cache

echo "🚀 Starting services..."
docker-compose up -d

echo "⏳ Waiting for MongoDB to start..."
sleep 15

echo "🔧 Initializing MongoDB replica set..."
docker exec -it mongodb mongosh --eval "
rs.initiate({
  _id: 'rs0',
  members: [{ _id: 0, host: 'mongodb:27017' }]
})
" || echo "⚠️ Replica set may already be initialized"

echo "⏳ Waiting for replica set..."
sleep 5

echo "📊 Checking replica set status..."
docker exec -it mongodb mongosh --eval "rs.status()"

echo ""
echo "📋 Creating Kafka topics..."
docker exec -it kafka bash -c "
/opt/kafka/bin/kafka-topics.sh --create --topic order-created --bootstrap-server localhost:9092 --partitions 1 --replication-factor 1 2>/dev/null || echo 'Topic already exists'
/opt/kafka/bin/kafka-topics.sh --create --topic inventory-reserved --bootstrap-server localhost:9092 --partitions 1 --replication-factor 1 2>/dev/null || echo 'Topic already exists'
/opt/kafka/bin/kafka-topics.sh --create --topic inventory-failed --bootstrap-server localhost:9092 --partitions 1 --replication-factor 1 2>/dev/null || echo 'Topic already exists'
/opt/kafka/bin/kafka-topics.sh --create --topic payment-success --bootstrap-server localhost:9092 --partitions 1 --replication-factor 1 2>/dev/null || echo 'Topic already exists'
/opt/kafka/bin/kafka-topics.sh --create --topic payment-failed --bootstrap-server localhost:9092 --partitions 1 --replication-factor 1 2>/dev/null || echo 'Topic already exists'
"

echo ""
echo "✅ All services started!"
echo ""
echo "📋 Check logs: docker-compose logs -f"
echo "🔍 Test Order API: curl http://localhost:3001/api/health"
echo "🔍 Test Inventory API: curl http://localhost:3002/api/health"
echo ""
echo "📝 Create order:"
echo "curl -X POST http://localhost:3001/api/orders -H 'Content-Type: application/json' -d '{\"productId\":\"prod_001\",\"quantity\":2,\"amount\":99.99}'"
echo ""
echo "📦 Initialize inventory:"
echo "curl -X POST http://localhost:3002/api/inventory/init -H 'Content-Type: application/json' -d '{\"productId\":\"prod_001\",\"stock\":100}'""
```

```bash 
{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}
{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}
{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{PORT FORWARDING }}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}
{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}
{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}
## For the Order Service:
kubectl port-forward svc/order-service 3001:3001 -n ecommerce

## Inventory Service:
kubectl port-forward svc/inventory-service 3002:3002 -n ecommerce

## Payment Service:
kubectl port-forward svc/payment-service 3003:3003 -n ecommerce

## Then access:
http://localhost:3001
http://localhost:3002
http://localhost:3003

```



```bash
## to check the logs
{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}
{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}
{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}
{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}
{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}
# Watch all services
docker-compose logs -f

# Watch specific service
docker-compose logs -f order-service
docker-compose logs -f inventory-service
docker-compose logs -f payment-service

```



```bash
echo "🚀 Testing Complete Saga Flow"
echo "================================="

# 1. Create Product
echo "1️⃣ Creating product..."
curl -s -X POST http://localhost:3002/inventory/products \
  -H "Content-Type: application/json" \
  -d '{"productId":"prod_001","stock":100}' | jq .
echo ""

# 2. Create Order
echo "2️⃣ Creating order..."
ORDER_RESPONSE=$(curl -s -X POST http://localhost:3001/orders \
  -H "Content-Type: application/json" \
  -d '{"productId":"prod_001","quantity":2,"amount":99.99}')

echo "$ORDER_RESPONSE" | jq .
ORDER_ID=$(echo "$ORDER_RESPONSE" | jq -r '.data.orderId')
echo "Order ID: $ORDER_ID"
echo ""

# 3. Wait for processing
sleep 3

# 4. Check Order Status
echo "3️⃣ Checking order status..."
curl -s http://localhost:3001/orders/$ORDER_ID | jq .
echo ""

# 5. Check Inventory
echo "4️⃣ Checking inventory..."
curl -s http://localhost:3002/inventory/products/prod_001 | jq .
echo ""

# 6. Check Payment
echo "5️⃣ Checking payment..."
curl -s http://localhost:3003/payment/order/$ORDER_ID | jq .
echo ""

echo "✅ Test Complete!"




