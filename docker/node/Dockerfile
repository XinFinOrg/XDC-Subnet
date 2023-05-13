FROM golang:1.14 as builder

RUN apt-get update && apt-get install -y git build-essential

COPY . /builder

RUN cd /builder && make XDC

# The actual image for subnet containers
FROM golang:1.14

RUN apt-get update && apt-get install -y git build-essential

WORKDIR /work

COPY --from=builder /builder/build/bin/XDC /usr/bin
RUN chmod +x /usr/bin/XDC
    
# Copy over files
ADD docker/node/start.sh /work/start.sh

# Create an empty pwd file
RUN touch /work/.pwd

# rpc
EXPOSE 8545
# ws
EXPOSE 8555
# port
EXPOSE 30303

ENTRYPOINT ["bash","/work/start.sh"]