# ============================
# Stage 1 – BUILDER
# ============================
FROM python:3.11-slim AS builder

# Utworzenie virtualenv
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Kopiujemy wymagania
COPY requirements.txt .

# Instalujemy zależności z sekretem pip.conf
RUN --mount=type=secret,id=pip_conf,target=/etc/pip.conf \
    --mount=type=secret,id=ca_cert,target=/etc/ssl/certs/ca.pem \
    pip install \
        --trusted-host host.com.pl \
        --trusted-host pypi.org \
        --trusted-host files.pythonhosted.org \
        --no-cache-dir -r requirements.txt


# ============================
# Stage 2 – FINAL IMAGE
# ============================
FROM python:3.11-slim

# Wrzucamy virtualenv z buildera
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /app

# Kopiujemy cały kod aplikacji
COPY . .

# Tworzymy katalog na SQLite
RUN mkdir -p /data

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
