```bash
checking the readiness and liveliness probe  
Terminal 1 — start port-forward
kubectl port-forward svc/order-service 3001:3001 -n ecommerce

You should see:

Forwarding from 127.0.0.1:3001 -> 3001

Keep this terminal running. Do not press Ctrl+C.

Terminal 2 — call the API
curl http://localhost:3001/health/ready


# Main difference
****READINESS PROBE****
    ↓
Can this Pod receive traffic?
    ↓
No
    ↓
Remove Pod from Service traffic
    ↓
Container keeps running

****LIVENESS PROBE****
    ↓
Is this application still alive?
    ↓
No
    ↓
Restart the container
```