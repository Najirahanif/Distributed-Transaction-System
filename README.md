```bash 
## Step 1: Start Everything
docker compose up -d

Check the containers:

docker ps

Expected:

mongodb

kafka

kafka-ui
## Step 4: Open Kafka UI

Visit:

http://localhost:8080

Initially there will be no topics.

## Step 5: Connect to MongoDB
docker exec -it mongodb mongosh
## Step 6: Create Databases

Inside MongoDB:

use order-db

db.createCollection("orders")

db.createCollection("orderAudit")

Inventory

use inventory-db

db.createCollection("products")

db.createCollection("inventoryLogs")

Payment

use payment-db

db.createCollection("payments")

db.createCollection("paymentAudit")

## Verify:

show dbs
## Step 7: Create Kafka Topics

## Enter the Kafka container:

docker exec -it kafka bash

## Create topics:

/opt/kafka/bin/kafka-topics.sh \
--create \
--topic order-created \
--bootstrap-server localhost:9092

/opt/kafka/bin/kafka-topics.sh \
--create \
--topic inventory-reserved \
--bootstrap-server localhost:9092

/opt/kafka/bin/kafka-topics.sh \
--create \
--topic inventory-failed \
--bootstrap-server localhost:9092

/opt/kafka/bin/kafka-topics.sh \
--create \
--topic payment-success \
--bootstrap-server localhost:9092

/opt/kafka/bin/kafka-topics.sh \
--create \
--topic payment-failed \
--bootstrap-server localhost:9092

## List topics:

/opt/kafka/bin/kafka-topics.sh \
--list \
--bootstrap-server localhost:9092

## Expected:

order-created
inventory-reserved
inventory-failed
payment-success
payment-failed

## Step 8: Environment Variables

Each service should have its own .env.

## Order Service
PORT=3001
MONGO_URI=mongodb://mongodb:27017/order-db
KAFKA_BROKER=kafka:9092

## Inventory Service
PORT=3002
MONGO_URI=mongodb://mongodb:27017/inventory-db
KAFKA_BROKER=kafka:9092

## Payment Service
PORT=3003
MONGO_URI=mongodb://mongodb:27017/payment-db
KAFKA_BROKER=kafka:9092



## reconfigure the replica set

cfg = rs.conf()
cfg.members[0].host = "localhost:27017"
rs.reconfig(cfg, { force: true })

## Now verify:

rs.conf()

## You should see:

host: "localhost:27017"

## and

db.hello()

```

















