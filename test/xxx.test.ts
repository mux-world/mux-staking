import { ethers, network } from "hardhat"
import "@nomiclabs/hardhat-waffle"
import { toWei, createContract, sleep, ensureFinished } from "./deployUtils"
import { TestMuxRewardTracker, MuxDistributor } from "../typechain"
import { Wallet } from "ethers"

describe("MlpRewardTracker", async () => {
  let deployer: Wallet
  let veMuxTracker: TestMuxRewardTracker
  let muxDistributor: MuxDistributor

  before(async () => {
    deployer = new Wallet("", ethers.provider)

    // fork begins
    await network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            jsonRpcUrl: "https://arb1.arbitrum.io/rpc",
          },
        },
      ],
    })

    console.log("upgrading in fork")
    // const tx = await deployer.sendTransaction({
    //   from: deployer.address,
    //   to: deployer.address,
    // })
    // console.log("forking", tx.hash)
    // await tx.wait()
    // throw new Error("let us check")

    veMuxTracker = await ethers.getContractAt("TestMuxRewardTracker", "0x798a769e607e5d8fdd1327a692340ee8ad89f57b")
    muxDistributor = await ethers.getContractAt("MuxDistributor", "0x851Fc8498f59B3F8108015B3c7eF5f0281C444aB")

    const proxyAdmin = await ethers.getContractAt("ProxyAdmin", "0xE52d9a3CBA458832A65cfa9FC8a74bacAbdeB32A")
    const newImp = await createContract("MuxRewardTracker")
    await ensureFinished(proxyAdmin.connect(deployer).upgrade(veMuxTracker.address, newImp.address))
    const newImp2 = await createContract("MuxDistributor")
    await ensureFinished(proxyAdmin.connect(deployer).upgrade(muxDistributor.address, newImp2.address))
  })

  after(async () => {
    await network.provider.request({
      method: "hardhat_reset",
      params: [],
    })
  })

  it("xxx", async () => {
    await ensureFinished(veMuxTracker.claimable("8371f1525fb09c2915828c6c2718f30095a6d094"))
  })
})
