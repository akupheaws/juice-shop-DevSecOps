FROM node:22-bookworm-slim AS installer
COPY . /juice-shop
WORKDIR /juice-shop
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN npm ci
RUN npm prune --omit=dev --ignore-scripts
RUN rm -rf frontend/node_modules
RUN rm -rf frontend/.angular
RUN rm -rf frontend/src/assets
RUN mkdir logs
RUN chown -R 65532 logs
RUN chgrp -R 0 ftp/ frontend/dist/ logs/ data/ i18n/
RUN chmod -R g=u ftp/ frontend/dist/ logs/ data/ i18n/
RUN rm data/chatbot/botDefaultTrainingData.json || true
RUN rm ftp/legal.md || true
RUN rm i18n/*.json || true

FROM gcr.io/distroless/nodejs22-debian12
WORKDIR /juice-shop
COPY --from=installer --chown=65532:0 /juice-shop .
ENV NODE_ENV=production
USER 65532
EXPOSE 3000
CMD ["/juice-shop/build/app.js"]
