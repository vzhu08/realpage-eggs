# Exact multi-architecture manifests from the official Docker Library images.
# Regenerate derived frontend contracts inside the build; UX source stays unchanged.
FROM node:22-bookworm-slim@sha256:43ac6c60b8f89723f746e8a92ce91abd5017e627ce1ddfe4238355d3a30b772c AS frontend
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY contracts/ /build/contracts/
COPY frontend/ ./
RUN npm run generate && npm run verify

FROM python:3.12.14-slim-bookworm@sha256:392307d22300de8b5986851a12d9176dfc0fc073e65bf6523ebd7dcbeb23564e AS runtime
ARG SOURCE_REVISION
LABEL org.opencontainers.image.title="Rental Housing Law Navigator" \
      org.opencontainers.image.source="https://github.com/vzhu08/realpage-eggs" \
      org.opencontainers.image.revision="${SOURCE_REVISION}"
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PYTHON_DOTENV_DISABLED=1 \
    NAVIGATOR_DATA_DIR=/data NAVIGATOR_FRONTEND_DIST=/app/public \
    NAVIGATOR_CORS_ORIGINS="" OPENAI_API_KEY="" OPENAI_MODEL=""
WORKDIR /app
RUN python -c "import os,re,sys; sys.exit(0 if re.fullmatch('[0-9a-f]{40}', os.environ.get('SOURCE_REVISION', '')) else 'SOURCE_REVISION must be a full Git commit SHA')"
COPY requirements.lock ./
RUN python -m pip --isolated install --no-cache-dir --index-url https://pypi.org/simple -r requirements.lock && python -m pip check
COPY navigator/ navigator/
COPY config/ config/
COPY contracts/ contracts/
COPY fixtures/ fixtures/
COPY --from=frontend /build/frontend/dist/ public/
USER 10001:10001
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health', timeout=3)"
CMD ["python", "-m", "uvicorn", "navigator.api:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
