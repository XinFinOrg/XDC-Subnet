// Copyright 2015 The go-ethereum Authors
// This file is part of the go-ethereum library.
//
// The go-ethereum library is free software: you can redistribute it and/or modify
// it under the terms of the GNU Lesser General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// The go-ethereum library is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Lesser General Public License for more details.
//
// You should have received a copy of the GNU Lesser General Public License
// along with the go-ethereum library. If not, see <http://www.gnu.org/licenses/>.

package params

// MainnetBootnodes are the enode URLs of the P2P bootstrap nodes running on
// the main Ethereum network.
var MainnetBootnodes = []string{
	// XDPoSChain Bootnodes Mainnet
	"enode://fd3da177f9492a39d1e7ce036b05745512894df251399cb3ec565081cb8c6dfa1092af8fac27991e66b6af47e9cb42e02420cc89f8549de0ce513ee25ebffc3a@3.212.20.0:30303",
	"enode://97f0ca95a653e3c44d5df2674e19e9324ea4bf4d47a46b1d8560f3ed4ea328f725acec3fcfcb37eb11706cf07da669e9688b091f1543f89b2425700a68bc8876@104.248.98.78:30301",
	"enode://b72927f349f3a27b789d0ca615ffe3526f361665b496c80e7cc19dace78bd94785fdadc270054ab727dbb172d9e3113694600dd31b2558dd77ad85a869032dea@188.166.207.189:30301",
	"enode://c8f2f0643527d4efffb8cb10ef9b6da4310c5ac9f2e988a7f85363e81d42f1793f64a9aa127dbaff56b1e8011f90fe9ff57fa02a36f73220da5ff81d8b8df351@104.248.98.60:30301",

	// Ethereum Foundation Go Bootnodes
	// "enode://a979fb575495b8d6db44f750317d0f4622bf4c2aa3365d6af7c284339968eef29b69ad0dce72a4d8db5ebb4968de0e3bec910127f134779fbcb0cb6d3331163c@52.16.188.185:30303", // IE
	// "enode://3f1d12044546b76342d59d4a05532c14b85aa669704bfe1f864fe079415aa2c02d743e03218e57a33fb94523adb54032871a6c51b2cc5514cb7c7e35b3ed0a99@13.93.211.84:30303",  // US-WEST
	// "enode://78de8a0916848093c73790ead81d1928bec737d565119932b98c6b100d944b7a95e94f847f689fc723399d2e31129d182f7ef3863f2b4c820abbf3ab2722344d@191.235.84.50:30303", // BR
	// "enode://158f8aab45f6d19c6cbf4a089c2670541a8da11978a2f90dbf6a502a4a3bab80d288afdbeb7ec0ef6d92de563767f3b1ea9e8e334ca711e9f8e2df5a0385e8e6@13.75.154.138:30303", // AU
	// "enode://1118980bf48b0a3640bdba04e0fe78b1add18e1cd99bf22d53daac1fd9972ad650df52176e7c7d89d1114cfef2bc23a2959aa54998a46afcf7d91809f0855082@52.74.57.123:30303",  // SG

	// Ethereum Foundation C++ Bootnodes
	// "enode://979b7fa28feeb35a4741660a16076f1943202cb72b6af70d327f053e248bab9ba81760f39d0701ef1d8f89cc1fbd2cacba0710a12cd5314d5e0c9021aa3637f9@5.1.83.226:30303", // DE
}

// TestnetBootnodes are the enode URLs of the P2P bootstrap nodes running on the
// Ropsten test network.
var TestnetBootnodes = []string{
	// XDPoSChain Bootnodes Testnet
	"enode://4d3c2cc0ce7135c1778c6f1cfda623ab44b4b6db55289543d48ecfde7d7111fd420c42174a9f2fea511a04cf6eac4ec69b4456bfaaae0e5bd236107d3172b013@52.221.28.223:30301",
	"enode://298780104303fcdb37a84c5702ebd9ec660971629f68a933fd91f7350c54eea0e294b0857f1fd2e8dba2869fcc36b83e6de553c386cf4ff26f19672955d9f312@13.251.101.216:30301",
	"enode://46dba3a8721c589bede3c134d755eb1a38ae7c5a4c69249b8317c55adc8d46a369f98b06514ecec4b4ff150712085176818d18f59a9e6311a52dbe68cff5b2ae@13.250.94.232:30301",
	// "enode://30b7ab30a01c124a6cceca36863ece12c4f5fa68e3ba9b0b51407ccc002eeed3b3102d20a88f1c1d3c3154e2449317b8ef95090e77b312d5cc39354f86d5d606@52.176.7.10:30303",    // US-Azure geth
	// "enode://865a63255b3bb68023b6bffd5095118fcc13e79dcf014fe4e47e065c350c7cc72af2e53eff895f11ba1bbb6a2b33271c1116ee870f266618eadfc2e78aa7349c@52.176.100.77:30303",  // US-Azure parity
	// "enode://6332792c4a00e3e4ee0926ed89e0d27ef985424d97b6a45bf0f23e51f0dcb5e66b875777506458aea7af6f9e4ffb69f43f3778ee73c81ed9d34c51c4b16b0b0f@52.232.243.152:30303", // Parity
	// "enode://94c15d1b9e2fe7ce56e458b9a3b672ef11894ddedd0c6f247e0f1d3487f52b66208fb4aeb8179fce6e3a749ea93ed147c37976d67af557508d199d9594c35f09@192.81.208.223:30303", // @gpip
}

// DiscoveryV5Bootnodes are the enode URLs of the P2P bootstrap nodes for the
// experimental RLPx v5 topic-discovery network.
var DiscoveryV5Bootnodes = []string{
	"enode://06051a5573c81934c9554ef2898eb13b33a34b94cf36b202b69fde139ca17a85051979867720d4bdae4323d4943ddf9aeeb6643633aa656e0be843659795007a@35.177.226.168:30303",
	"enode://0cc5f5ffb5d9098c8b8c62325f3797f56509bff942704687b6530992ac706e2cb946b90a34f1f19548cd3c7baccbcaea354531e5983c7d1bc0dee16ce4b6440b@40.118.3.223:30304",
	"enode://1c7a64d76c0334b0418c004af2f67c50e36a3be60b5e4790bdac0439d21603469a85fad36f2473c9a80eb043ae60936df905fa28f1ff614c3e5dc34f15dcd2dc@40.118.3.223:30306",
	"enode://85c85d7143ae8bb96924f2b54f1b3e70d8c4d367af305325d30a61385a432f247d2c75c45c6b4a60335060d072d7f5b35dd1d4c45f76941f62a4f83b6e75daaf@40.118.3.223:30307",
}
