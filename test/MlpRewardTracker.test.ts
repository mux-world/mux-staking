import { ethers } from "hardhat"
import "@nomiclabs/hardhat-waffle"
import { expect } from "chai"
import { toWei, createContract, sleep } from "./deployUtils"
import { Contract } from "ethers"
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

    before(async () => {
        const accounts = await ethers.getSigners()
        user0 = accounts[0]
        user1 = accounts[1]
        user2 = accounts[2]
        user3 = accounts[3]
    })

    it("fee1", async () => {
        const weth = await createContract("MockERC20", ["WETH", "WETH", 18])
        const mlp = await createContract("MockERC20", ["MLP", "MLP", 18])
        const tracker = await createContract("MlpRewardTracker")
        const veTracker = await createContract("BlackHole")
        const manager = await createContract("MockRewardManager")
        const dist = await createContract("TestFeeDistributor")

        await tracker.initialize("StakedMlp", "SMLP", [mlp.address], dist.address)
        await dist.initialize(weth.address, manager.address, tracker.address, veTracker.address, toWei("0.5"))

        await mlp.mint(user0.address, toWei("1000"))
        await mlp.approve(tracker.address, toWei("1000"))
        await tracker.stake(mlp.address, toWei("1000"))

        expect(await tracker.balanceOf(user0.address)).to.equal(toWei("1000"))
        expect(await tracker.callStatic.claimable(user0.address)).to.equal(0)

        // 0
        await weth.mint(user0.address, toWei("5000"))
        await weth.approve(dist.address, toWei("50000"))
        await dist.setBlockTime(86400 * 7)
        await dist.notifyReward(toWei("5000"))

        var start = await dist.epochBeginTime()
        var end = await dist.epochEndTime()
        var rate = B.from(toWei("5000")).div(B.from(end - start))
        expect(await dist.rewardRate()).to.equal(rate)
        expect(await weth.balanceOf(dist.address)).to.equal(toWei("5000"))
        // +3000
        {
            await dist.setBlockTime(86400 * 7 + 3000)
            expect(await dist.pendingRewards()).to.be.closeTo(B.from(3000).mul(rate), 1000000)
        }
        // > 7 days
        {
            await dist.setBlockTime(86400 * 7 * 2 + 2000)
            expect(await dist.pendingRewards()).to.be.closeTo(toWei("5000"), 1000000)
        }
        // restart
        await dist.setBlockTime(86400 * 7 * 3 + 86400) // 3 weeks + 1 day
        await weth.mint(user0.address, toWei("2000"))
        await dist.notifyReward(toWei("2000"))
        expect(await weth.balanceOf(dist.address)).to.be.closeTo(toWei("2000"), 1000000)

        var start = await dist.epochBeginTime()
        var end = await dist.epochEndTime()
        var rate = B.from(toWei("2000")).div(B.from(end - start))
        expect(await dist.rewardRate()).to.be.closeTo(rate, 1000)
        {
            await dist.setBlockTime(86400 * 7 * 3 + 86400 * 2) // 3 weeks + 2 days
            expect(await dist.pendingRewards()).to.be.closeTo(B.from(86400).mul(rate), 1000000)
        }
        await weth.mint(user0.address, toWei("2000"))
        await dist.notifyReward(toWei("1000"))
        var rate = B.from(toWei("3000").sub(B.from(86400).mul(rate))).div(B.from(end - start - 86400))
        expect(await dist.rewardRate()).to.be.closeTo(rate, 1000)
        {
            await dist.setBlockTime(86400 * 7 * 3 + 86400 * 3) // 3 weeks + 3 days
            expect(await dist.pendingRewards()).to.be.closeTo(B.from(86400).mul(rate), 1000000)
        }
    })

    it("fee2", async () => {
        const weth = await createContract("MockERC20", ["WETH", "WETH", 18])
        const mlp = await createContract("MockERC20", ["MLP", "MLP", 18])
        const tracker = await createContract("MlpRewardTracker")
        const veTracker = await createContract("BlackHole")
        const manager = await createContract("MockRewardManager")
        const dist = await createContract("TestFeeDistributor")

        await tracker.initialize("StakedMlp", "SMLP", [mlp.address], dist.address)
        await dist.initialize(weth.address, manager.address, tracker.address, veTracker.address, toWei("0.5"))

        await mlp.mint(user0.address, toWei("1000"))
        await mlp.approve(tracker.address, toWei("1000"))
        await tracker.stake(mlp.address, toWei("1000"))

        expect(await tracker.balanceOf(user0.address)).to.equal(toWei("1000"))
        expect(await tracker.callStatic.claimable(user0.address)).to.equal(0)

        // 0
        await weth.mint(user0.address, toWei("5000"))
        await weth.approve(dist.address, toWei("5000"))
        await dist.setBlockTime(86400 * 7)
        await dist.notifyReward(toWei("5000"))

        // +3000
        await dist.setBlockTime(86400 * 7 + 3000)
        var amount0 = await dist.pendingMlpRewards();
        expect(await tracker.callStatic.claimable(user0.address)).to.be.closeTo(amount0, 10000)
        await tracker.claim(user0.address)

        await mlp.mint(user1.address, toWei("1500"))
        await mlp.connect(user1).approve(tracker.address, toWei("1500"))
        await tracker.connect(user1).stake(mlp.address, toWei("1500"))

        await dist.setBlockTime(86400 * 7 + 6000)
        var amount1 = await dist.pendingMlpRewards()
        console.log(amount0, amount1)

        expect(await tracker.callStatic.claimable(user0.address)).to.be.closeTo(amount1.mul(B.from(toWei("0.4"))).div(toWei("1")), 10000)
        expect(await tracker.callStatic.claimable(user1.address)).to.be.closeTo(amount1.mul(B.from(toWei("0.6"))).div(toWei("1")), 10000)
    })

    it("fee3", async () => {
        const weth = await createContract("MockERC20", ["WETH", "WETH", 18])
        const mlp = await createContract("MockERC20", ["MLP", "MLP", 18])
        const mcb = await createContract("MockERC20", ["MUX", "MUX", 18])
        const mux = await createContract("MockERC20", ["ESMUX", "ESMUX", 18])
        const vemux = await createContract("TestVotingEscrow")
        const manager = await createContract("MockRewardManager")

        const mlpTracker = await createContract("MlpRewardTracker")
        const muxTracker = await createContract("TestMuxRewardTracker")
        const dist = await createContract("TestFeeDistributor")

        await vemux.initialize(mcb.address, mux.address, "VEMUX", "VEMUX", 0)
        await mlpTracker.initialize("StakedMlp", "SMLP", [mlp.address], dist.address)
        await muxTracker.initialize(dist.address, vemux.address, weth.address, 1000)
        await dist.initialize(weth.address, manager.address, mlpTracker.address, muxTracker.address, toWei("0.5"))
        await vemux.setHandler(user0.address, true)
        await muxTracker.setHandler(user0.address, true)

        const setBlockTime = async (n: Number) => {
            await dist.setBlockTime(n)
            await vemux.setBlockTime(n)
            await muxTracker.setBlockTime(n)
        }

        // start from 1000
        var time = 1000
        await setBlockTime(time)
        // ==============================================================
        const mlpAmount = B.from(toWei("1000"))
        const muxAmount = B.from(toWei("1000"))
        // stake mlp
        await mlp.mint(user0.address, mlpAmount)
        await mlp.approve(mlpTracker.address, mlpAmount)
        await mlpTracker.stake(mlp.address, mlpAmount)
        await mlp.mint(user2.address, mlpAmount)
        await mlp.connect(user2).approve(mlpTracker.address, mlpAmount)
        await mlpTracker.connect(user2).stake(mlp.address, mlpAmount)

        await mcb.mint(user0.address, muxAmount)
        await mcb.approve(vemux.address, muxAmount)
        await vemux.depositFor(user0.address, user0.address, mcb.address, muxAmount, time + 86400 * 365)
        expect(await vemux.balanceOf(user0.address)).to.be.closeTo(muxAmount.div(4), toWei("0.01"))
        await manager.setPoolOwnedRate(toWei("0.5")) // 1000:1000

        // fee
        await weth.mint(user0.address, toWei("5000"))
        await weth.approve(dist.address, toWei("5000"))
        await dist.notifyReward(toWei("5000"))

        // + 3 days 
        time += 86400 * 3
        await dist.setBlockTime(time)
        // ==============================================================
        var start = await dist.epochBeginTime()
        var end = await dist.epochEndTime()
        var rate = B.from(toWei("5000")).div(B.from(end - start))
        expect(await dist.rewardRate()).to.equal(rate)
        var reward = B.from(86400 * 3).mul(rate)

        expect(await dist.pendingRewards()).to.be.closeTo(reward, epsilon)
        expect(await dist.pendingMuxRewards()).to.be.closeTo(reward.div(4), epsilon) // reward / 2 * 50%
        expect(await dist.pendingMlpRewards()).to.be.closeTo(reward.div(2).div(2), epsilon)

        await mlpTracker.claim(user0.address)
        expect(await weth.balanceOf(user0.address)).to.be.closeTo(reward.div(2).div(2).div(2), epsilon)

        await muxTracker.claimForAccount(user0.address, user0.address)
        expect(await weth.balanceOf(user0.address)).to.be.closeTo(reward.div(2).div(2).div(2), epsilon)
    })


})
