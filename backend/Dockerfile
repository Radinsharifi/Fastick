# syntax=docker/dockerfile:1.7
FROM python:3.12-slim
ARG APT_MIRROR_HOST=mirror.iranserver.com
ARG PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple
WORKDIR /app
RUN find /etc/apt -type f \( -name '*.sources' -o -name 'sources.list' \) \
    -exec sed -i -e "s|deb.debian.org|${APT_MIRROR_HOST}|g" \
        -e "s|security.debian.org|${APT_MIRROR_HOST}|g" {} + \
    && apt-get -o Acquire::Retries=3 -o Acquire::http::Timeout=60 update \
    && apt-get install -y --no-install-recommends fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip,sharing=locked \
    pip install --index-url "${PIP_INDEX_URL}" --retries 10 --timeout 120 -r requirements.txt
COPY app ./app
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
