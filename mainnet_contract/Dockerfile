FROM python:3.9-alpine

RUN apk add gcc git musl-dev rust cargo

WORKDIR /app 
ADD . /app

ENTRYPOINT ["./deploy.sh"]