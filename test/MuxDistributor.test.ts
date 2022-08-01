import { ethers } from "hardhat"
import "@nomiclabs/hardhat-waffle"
import { expect } from "chai"
import { toWei, createContract, sleep } from "./deployUtils"
import { Contract, ContractReceipt } from "ethers"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
const U = ethers.utils
const B = ethers.BigNumber

describe("MlpRewardTracker", async () => {
    let user0: SignerWithAddress
    let user1: SignerWithAddress
    let user2: SignerWithAddress
    let user3: SignerWithAddress

    let router: Contract
    let zeroAddress = "0x0000000000000000000000000000000000000000"
    let epsilon = "1000000000"
    let year = 365 * 86400

    let dist: Contract
    let mux: Contract
    let manager: Contract
    let mlpTracker: Contract
    let veTracker: Contract


    before(async () => {
        const accounts = await ethers.getSigners()
        user0 = accounts[0]
        user1 = accounts[1]
        user2 = accounts[2]
        user3 = accounts[3]
    })

    beforeEach(async () => {
        dist = await createContract("TestMuxDistributor")
        mux = await createContract("MockERC20", ["MUX", "MUX", 18])
        manager = await createContract("MockRewardManager")
        mlpTracker = await createContract("BlackHole")
        veTracker = await createContract("BlackHole")

        await dist.initialize(mux.address, manager.address, mlpTracker.address, veTracker.address, 0)
        await mux.grantRole(U.id("MINTER_ROLE"), dist.address)
    })

    const setBlockTime = async (n: Number) => {
        await dist.setBlockTime(n)
    }

    it("mux - no start time", async () => {
        await setBlockTime(364 * 86400)
        expect(await dist.pendingRewards()).to.equal(0)

        await setBlockTime(364 * 86400 + year)
        expect(await dist.pendingRewards()).to.equal(0)
    })

    it("mux - set start time", async () => {
        await setBlockTime(364 * 86400)
        expect(await dist.pendingRewards()).to.equal(0)
        await dist.setLastDistributionTime(364 * 86400 + year)
        await dist.setRewardRate(toWei("0.1"))

        await setBlockTime(364 * 86400 + year)
        expect(await dist.pendingRewards()).to.equal(0)

        await setBlockTime(364 * 86400 + year + 86400)
        expect(await dist.pendingRewards()).to.equal(toWei("8640"))

        await dist.setRewardRate(toWei("0"))
        expect(await mux.balanceOf(mlpTracker.address)).to.equal(toWei("8640"))
        expect(await mux.balanceOf(veTracker.address)).to.equal(toWei("0"))

        await setBlockTime(364 * 86400 + year + 86400 * 2)
        expect(await dist.pendingRewards()).to.equal(toWei("0"))
        await dist.setRewardRate(toWei("0.01"))
        expect(await mux.balanceOf(mlpTracker.address)).to.equal(toWei("8640"))
        expect(await mux.balanceOf(veTracker.address)).to.equal(toWei("0"))

        await setBlockTime(364 * 86400 + year + 86400 * 3)
        expect(await dist.pendingRewards()).to.equal(toWei("864"))
    })

    it("mux - distribution", async () => {
        await setBlockTime(364 * 86400)
        await dist.setLastDistributionTime(364 * 86400)
        await dist.setRewardRate(toWei("0.1"))

        await setBlockTime(364 * 86400 + 86400)
        await manager.setPoolOwnedRate(toWei("0"))
        await manager.setVotingEscrowedRate(toWei("0"))

        expect(await dist.pendingRewards()).to.equal(toWei("8640"))
        var amount = toWei("8640")
            .mul(toWei("1").sub(toWei("0"))).div(toWei("1"))
            .mul(toWei("1").sub(toWei("0"))).div(toWei("1"))
        expect(await dist.pendingMlpRewards()).to.equal(amount)
        expect(await dist.pendingMuxRewards()).to.equal(toWei("8640").sub(amount))
    })
})
