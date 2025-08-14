# Parking Prediction API Documentation

## Overview

This API provides parking availability predictions based on time and zone information. It uses a machine learning model to predict the probability that a parking spot will be unoccupied at a given time and location.

## Base URL

```
http://localhost:8000
```

## Endpoints

### Health Check

**GET** `/`

Returns the health status of the API.

#### Response

```json
{
  "ok": true
}
```

#### Status Codes
- `200 OK` - Service is healthy

---

### Parking Prediction

**POST** `/predict`

Predicts the probability of finding an unoccupied parking spot based on zone, current time, and commute duration.

#### Request Body

```json
{
  "zone_number": 7988,
  "commute_minutes": 12,
  "now_time": "09:30"
}
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `zone_number` | integer | Yes | The parking zone identifier |
| `now_time` | string | Yes | Current time in "HH:MM" or "HH:MM:SS" format (24-hour) |
| `commute_minutes` | number | No | Travel time to the zone in minutes (default: 0) |

#### Response

```json
{
  "zone_number": 7988,
  "now_time": "09:30",
  "arrival_minute_of_day": 582,
  "prob_unoccupied": 0.75
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `zone_number` | integer | The requested parking zone |
| `now_time` | string | The provided current time |
| `arrival_minute_of_day` | integer | Calculated arrival time as minute of day (0-1439) |
| `prob_unoccupied` | number | Probability (0-1) that a parking spot will be unoccupied |

#### Status Codes
- `200 OK` - Successful prediction
- `400 Bad Request` - Invalid request parameters

#### Error Response

```json
{
  "error": "Required keys: zone_number, now_time; optional: commute_minutes"
}
```

## Model Details

### Time Encoding
The API converts time to a cyclic representation using sine and cosine functions:
- Input time is converted to minute-of-day (0-1439)
- Arrival time = (current_time + commute_minutes) % 1440
- Features: `sin_time`, `cos_time`, `zone_number`

### Timezone
The model operates in **Australia/Melbourne** timezone as specified in the metadata.

## Usage Examples

### Basic Prediction

```bash
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{
    "zone_number": 7988,
    "now_time": "09:30"
  }'
```

### Prediction with Commute Time

```bash
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{
    "zone_number": 7988,
    "commute_minutes": 15,
    "now_time": "14:45:30"
  }'
```

### Python Example

```python
import requests

url = "http://localhost:8000/predict"
data = {
    "zone_number": 7988,
    "commute_minutes": 12,
    "now_time": "09:30"
}

response = requests.post(url, json=data)
result = response.json()

print(f"Probability of finding parking: {result['prob_unoccupied']:.2%}")
```

### JavaScript Example

```javascript
const response = await fetch('http://localhost:8000/predict', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    zone_number: 7988,
    commute_minutes: 12,
    now_time: "09:30"
  })
});

const result = await response.json();
console.log(`Probability: ${(result.prob_unoccupied * 100).toFixed(1)}%`);
```

## Deployment

### Using Docker

```bash
docker build -t parking-api .
docker run -p 8000:8000 parking-api
```

### Direct Python

```bash
pip install -r requirements.txt
python api_time_only.py
```

## Dependencies

- Flask 3.1.1
- pandas 2.2.2
- numpy 2.0.2
- scikit-learn 1.6.1
- joblib 1.5.1

## Notes

- Time format accepts both "HH:MM" and "HH:MM:SS"
- All times are processed in 24-hour format
- The model uses minute-of-day representation (0-1439)
- Predictions are probabilistic (0.0 = definitely occupied, 1.0 = definitely unoccupied)
- The API runs on all interfaces (0.0.0.0) on port 8000
