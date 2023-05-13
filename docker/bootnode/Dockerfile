FROM golang:1.14 as builder

RUN apt-get update && apt-get install -y git build-essential

COPY . /builder
RUN cd /builder && make bootnode

RUN chmod +x /builder/build/bin/bootnode

FROM golang:1.14

RUN apt-get update && apt-get install -y git build-essential

WORKDIR /work

COPY --from=builder /builder/build/bin/bootnode /usr/local/bin/bootnode
RUN chmod +x /usr/local/bin/bootnode

COPY docker/bootnode ./

EXPOSE 30301

ENTRYPOINT ["bash","/work/start.sh"]

CMD ["-verbosity", "6", "-nodekey", "bootnode.key", "--addr", ":30301"]