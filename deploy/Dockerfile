FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PYTHON_DOTENV_DISABLED=1 NAVIGATOR_DATA_DIR=/data
WORKDIR /app
COPY requirements.lock ./
RUN python -m pip install --no-cache-dir -r requirements.lock && python -m pip check
COPY navigator/ navigator/
COPY config/ config/
COPY contracts/ contracts/
COPY fixtures/ fixtures/
USER 10001:10001
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health', timeout=3)"
CMD ["python", "-m", "uvicorn", "navigator.api:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
