# Horizontal Pod Autoscaler (HPA) Testing Guide

## Objective

Test Kubernetes Horizontal Pod Autoscaler (HPA) by generating CPU load on the Order Service and verify that Kubernetes automatically scales the application.

---

# Step 1: Verify Kubernetes Cluster

Check the current Kubernetes context.

```bash
kubectl config current-context
```

Expected:

```
kind-microservices
```

Verify the cluster is running.

```bash
kubectl cluster-info
```

Check the nodes.

```bash
kubectl get nodes
```

---

# Step 2: Verify Metrics Server

Check whether the Metrics Server is running.

```bash
kubectl get pods -n kube-system | grep metrics-server
```

Expected:

```
metrics-server-xxxxx   1/1   Running
```

Verify that metrics are available.

```bash
kubectl top pods -n ecommerce
```

If CPU and Memory values are displayed, the Metrics Server is working.

---

# Step 3: Deploy the Application

Run the Jenkins pipeline.

The pipeline performs:

* Build Docker Image
* Push Docker Image
* Deploy Order Service
* Deploy Kubernetes Service
* Deploy HPA
* Wait for Deployment Rollout

Verify:

```bash
kubectl get deployments -n ecommerce
kubectl get pods -n ecommerce
kubectl get svc -n ecommerce
```

---

# Step 4: Verify HPA

Check the HPA.

```bash
kubectl get hpa -n ecommerce
```

Example:

```
NAME                TARGETS
order-service-hpa   cpu: 8%/10%
```

Watch the HPA continuously.

```bash
kubectl get hpa -n ecommerce -w
```

This displays:

* Current CPU utilisation
* Target CPU utilisation
* Current replicas

---

# Step 5: Watch Pods

Open another terminal.

```bash
kubectl get pods -n ecommerce -w
```

This lets you observe pods being created or terminated.

---

# Step 6: Generate CPU Load

The application exposes the following endpoint:

```
http://distributed.service/orders/load
```

Generate continuous traffic.

Example:

```bash
for i in {1..1000}
do
    curl http://distributed.service/orders/load &
done

wait
```

Or use a load-testing tool.

Example using **hey**:

```bash
hey -n 10000 -c 100 http://distributed.service/orders/load
```

---

# Step 7: Observe HPA

Watch:

```bash
kubectl get hpa -n ecommerce -w
```

Example:

```
cpu: 8%/10%   REPLICAS: 2
```

During load:

```
cpu: 14%/10%   REPLICAS: 5
```

```
cpu: 15%/10%   REPLICAS: 7
```

This indicates that the CPU utilisation exceeded the configured target, so Kubernetes increased the number of pods automatically.

---

# Step 8: Observe Pods

Watch:

```bash
kubectl get pods -n ecommerce
```

Example:

```
order-service-xxxxx
order-service-yyyyy
order-service-zzzzz
order-service-aaaaa
order-service-bbbbb
order-service-ccccc
order-service-ddddd
```

The number of running pods should match the replica count reported by the HPA.

---

# Step 9: Stop the Load

Stop the load generator.

Wait several minutes.

Kubernetes will gradually reduce the number of replicas until it reaches the configured minimum (`minReplicas`).

---

# Useful Commands

## View HPA

```bash
kubectl get hpa -n ecommerce
```

## Watch HPA

```bash
kubectl get hpa -n ecommerce -w
```

## Describe HPA

```bash
kubectl describe hpa order-service-hpa -n ecommerce
```

## View CPU Usage

```bash
kubectl top pods -n ecommerce
```

## Watch Pods

```bash
kubectl get pods -n ecommerce -w
```

## View Deployment

```bash
kubectl get deployment order-service -n ecommerce
```

## View Pod Logs

```bash
kubectl logs <pod-name> -n ecommerce
```

---

# Expected Behaviour

| CPU Utilisation | HPA Action                                                                               |
| --------------: | ---------------------------------------------------------------------------------------- |
|    Below Target | No scaling (or scale down after the stabilization period, but never below `minReplicas`) |
| Equal to Target | Maintain the current number of replicas                                                  |
|    Above Target | Scale up by creating additional pods                                                     |

---

# End-to-End Flow

```
Run Jenkins Pipeline
        ↓
Deploy Application
        ↓
Deploy HPA
        ↓
Verify Metrics Server
        ↓
Watch HPA
        ↓
Watch Pods
        ↓
Generate Load
(http://distributed.service/orders/load)
        ↓
CPU Utilisation Increases
        ↓
HPA Creates New Pods
        ↓
Stop Load
        ↓
CPU Drops
        ↓
HPA Gradually Scales Back to minReplicas
```
