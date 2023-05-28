.PHONY: build cluster test

default: build

build:
	go build -o bin/swarm    github.com/XinFinOrg/XDC-Subnet/cmd/swarm
	go build -o bin/XDC     github.com/XinFinOrg/XDC-Subnet/cmd/XDC
	go build -o bin/bootnode github.com/XinFinOrg/XDC-Subnet/cmd/bootnode

cluster: build
	scripts/boot-cluster.sh

test:
	go test -v github.com/XinFinOrg/XDC-Subnet/swarm/...
