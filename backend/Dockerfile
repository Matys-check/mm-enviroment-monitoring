FROM python:3.11

WORKDIR /app

COPY requirements.txt .

# Copy host pip.conf if provided (place pip.conf in backend/ directory)
COPY pip.con[f] /etc/pip.conf

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create data directory for SQLite
RUN mkdir -p /data

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
