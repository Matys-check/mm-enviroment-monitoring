# syntax=docker/dockerfile:1
FROM python:3.11

WORKDIR /app

COPY requirements.txt .

RUN --mount=type=secret,id=pip_conf,target=/etc/pip.conf \
    --mount=type=secret,id=ca_cert,target=/usr/local/share/ca-certificates/ca.crt \
    update-ca-certificates && \
    pip install --no-cache-dir -r requirements.txt

COPY . .

# Create data directory for SQLite
RUN mkdir -p /data

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
