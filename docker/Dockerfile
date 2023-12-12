FROM golang:1.21 as builder

RUN apt-get update && apt-get install -y git build-essential

COPY . /builder

RUN go env -w GOFLAGS="-buildvcs=false"
RUN cd /builder && make XDC && make bootnode && make puppeth

# The actual image for subnet containers
FROM golang:1.21

RUN apt-get update && apt-get install -y git build-essential

WORKDIR /work

COPY --from=builder /builder/build/bin/XDC /usr/bin/XDC
COPY --from=builder /builder/build/bin/bootnode /usr/bin/bootnode
COPY --from=builder /builder/build/bin/puppeth /usr/bin/puppeth

RUN chmod +x /usr/bin/XDC
RUN chmod +x /usr/bin/bootnode
RUN chmod +x /usr/bin/puppeth
    
# Copy over files
ADD docker/start.sh /work/start.sh
ADD docker/start-bootnode.sh /work/start-bootnode.sh

# Create an empty pwd file
RUN touch /work/.pwd

# rpc
EXPOSE 8545
# ws
EXPOSE 8555
# port
EXPOSE 30303

# For bootnode
EXPOSE 30301
EXPOSE 30301/udp

ENTRYPOINT ["bash","/work/start.sh"]