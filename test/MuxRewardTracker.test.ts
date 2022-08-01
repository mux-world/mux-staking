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

    let zeroAddress = "0x0000000000000000000000000000000000000000"
    let epsilon = "100000000"
    let year = 365 * 86400
    let week = 7 * 86400
    let day = 86400

    let vemux: Contract
    let mcb: Contract
    let mux: Contract
    let tracker: Contract
    let dist: Contract
    let manager: Contract
    let bh: Contract

    before(async () => {
        const accounts = await ethers.getSigners()
        user0 = accounts[0]
        user1 = accounts[1]
        user2 = accounts[2]
        user3 = accounts[3]
    })

    beforeEach(async () => {
        mcb = await createContract("MockERC20", ["MUX", "MUX", 18])
        mux = await createContract("MockERC20", ["ESMUX", "ESMUX", 18])
        tracker = await createContract("TestMuxRewardTracker")
        manager = await createContract("MockRewardManager")
        bh = await createContract("BlackHole")
        vemux = await createContract("TestVotingEscrow")
        dist = await createContract("TestMuxDistributor")
    })

    const setBlockTime = async (n: Number) => {
        await dist.setBlockTime(n)
        await tracker.setBlockTime(n)
        await vemux.setBlockTime(n)
    }

    it("mcb", async () => {
        await vemux.initialize(
            mcb.address,
            mux.address,
            "veMux",
            "veMux",
            0
        )
        await dist.initialize(mux.address, manager.address, bh.address, tracker.address, 86400 * 364)
        await tracker.initialize(dist.address, vemux.address, mux.address, 86400 * 364)
        await mux.grantRole(U.id("MINTER_ROLE"), dist.address)

        await setBlockTime(86400 * 364)
        await dist.setRewardRate(toWei("0.1"))
        await manager.setPoolOwnedRate(toWei("0.5"))

        await mcb.mint(user0.address, toWei("100"))
        await mcb.approve(vemux.address, toWei("100"))
        await vemux.deposit(mcb.address, toWei("100"), 86400 * 364 + year * 4)
        expect(await vemux.balanceOf(user0.address)).to.be.closeTo(toWei("100"), epsilon)

        await setBlockTime(86400 * 364 + 86400 * 7)
        expect(await tracker.callStatic.claimable(user0.address)).to.be.closeTo(toWei("30240"), epsilon)
    })

    it("mcb - reward from epoch0", async () => {
        // week 0
        await vemux.initialize(
            mcb.address,
            mux.address,
            "veMux",
            "veMux",
            18
        )
        await dist.initialize(mux.address, manager.address, bh.address, tracker.address, week)
        await tracker.initialize(dist.address, vemux.address, mux.address, week)
        await mux.grantRole(U.id("MINTER_ROLE"), dist.address)
        await dist.setRewardRate(toWei("0.1"))
        await manager.setPoolOwnedRate(toWei("0.5"))

        // week 0+
        await setBlockTime(week + day)
        await mcb.mint(user0.address, toWei("100"))
        await mcb.approve(vemux.address, toWei("100"))
        await vemux.deposit(mcb.address, toWei("100"), week + year * 4)
        expect(await vemux.balanceOf(user0.address)).to.be.closeTo(toWei("100").mul(364 * 4 * 86400 - 86400).div(364 * 4 * 86400), epsilon)
        expect(await tracker.callStatic.claimable(user0.address)).to.be.closeTo(toWei("0"), epsilon)
        // week 0+
        await setBlockTime(week + day * 6)
        expect(await tracker.callStatic.claimable(user0.address)).to.be.closeTo(toWei("0"), epsilon)
        // week 1+
        await setBlockTime(week + day * 8)
        expect(await tracker.callStatic.claimable(user0.address)).to.be.closeTo(toWei("0"), epsilon)

        // week 2+
        await setBlockTime(week + day * 14)
        console.log(await dist.pendingRewards())
        expect(await tracker.callStatic.claimable(user0.address)).to.be.closeTo(toWei("30240"), epsilon)
    })

    it("mcb - reward from epoch1", async () => {
        // week 0
        await vemux.initialize(
            mcb.address,
            mux.address,
            "veMux",
            "veMux",
            18
        )
        await dist.initialize(mux.address, manager.address, bh.address, tracker.address, week)
        await tracker.initialize(dist.address, vemux.address, mux.address, week)
        await mux.grantRole(U.id("MINTER_ROLE"), dist.address)
        await dist.setRewardRate(toWei("0.1"))
        await manager.setPoolOwnedRate(toWei("0.5"))

        // week 1
        await setBlockTime(week)
        await mcb.mint(user0.address, toWei("100"))
        await mcb.approve(vemux.address, toWei("100"))
        await vemux.deposit(mcb.address, toWei("100"), week + year * 4)
        expect(await vemux.balanceOf(user0.address)).to.be.closeTo(toWei("100"), epsilon)
        expect(await tracker.callStatic.claimable(user0.address)).to.be.closeTo(toWei("0"), epsilon)

        // week 1
        await setBlockTime(week + day * 6)
        expect(await tracker.callStatic.claimable(user0.address)).to.be.closeTo(toWei("0"), epsilon)

        // week 2
        await setBlockTime(week + day * 8)
        expect(await tracker.callStatic.claimable(user0.address)).to.be.closeTo(toWei("30240"), epsilon)
    })

    it("mcb - reward from epoch1-mid", async () => {
        // week 0
        await vemux.initialize(
            mcb.address,
            mux.address,
            "veMux",
            "veMux",
            18
        )
        await dist.initialize(mux.address, manager.address, bh.address, tracker.address, week)
        await tracker.initialize(dist.address, vemux.address, mux.address, week)
        await mux.grantRole(U.id("MINTER_ROLE"), dist.address)
        await dist.setRewardRate(toWei("0.1"))
        await manager.setPoolOwnedRate(toWei("0.5"))

        // week 1
        await setBlockTime(week + day)
        await mcb.mint(user0.address, toWei("100"))
        await mcb.approve(vemux.address, toWei("100"))
        await vemux.deposit(mcb.address, toWei("100"), week + year * 4)
        expect(await tracker.callStatic.claimable(user0.address)).to.be.closeTo(toWei("0"), epsilon)

        // week 1
        await setBlockTime(week + day * 6)
        expect(await tracker.callStatic.claimable(user0.address)).to.be.closeTo(toWei("0"), epsilon)

        // week 2
        await setBlockTime(week + day * 8)
        expect(await tracker.callStatic.claimable(user0.address)).to.be.closeTo(toWei("0"), epsilon)

        // week 3
        await setBlockTime(week + day * 15)
        expect(await tracker.callStatic.claimable(user0.address)).to.be.closeTo(toWei("30240"), epsilon)
    })

    it("mcb - reward from epoch1", async () => {
        // week 0
        await vemux.initialize(
            mcb.address,
            mux.address,
            "veMux",
            "veMux",
            18
        )
        await dist.initialize(mux.address, manager.address, bh.address, tracker.address, 2 * week)
        await tracker.initialize(dist.address, vemux.address, mux.address, 2 * week)
        await mux.grantRole(U.id("MINTER_ROLE"), dist.address)
        await dist.setRewardRate(toWei("0.1"))
        await manager.setPoolOwnedRate(toWei("0.5"))

        // week 1
        await setBlockTime(week)
        await mcb.mint(user0.address, toWei("100"))
        await mcb.approve(vemux.address, toWei("100"))
        await vemux.deposit(mcb.address, toWei("100"), week + year * 4)
        expect(await vemux.balanceOf(user0.address)).to.be.closeTo(toWei("100"), epsilon)
        expect(await tracker.callStatic.claimable(user0.address)).to.be.closeTo(toWei("0"), epsilon)

        // week 1+
        await setBlockTime(week + day * 6)
        expect(await tracker.callStatic.claimable(user0.address)).to.be.closeTo(toWei("0"), epsilon)

        // week 2+
        await setBlockTime(week + day * 8)
        expect(await tracker.callStatic.claimable(user0.address)).to.be.closeTo(toWei("0"), epsilon)

        // week 3+
        await setBlockTime(week + day * 15)
        expect(await tracker.callStatic.claimable(user0.address)).to.be.closeTo(toWei("30240"), epsilon)
    })

    it("mcb - reward multi-weeks", async () => {
        // week 0
        await vemux.initialize(
            mcb.address,
            mux.address,
            "veMux",
            "veMux",
            18
        )
        await dist.initialize(mux.address, manager.address, bh.address, tracker.address, 2 * week)
        await tracker.initialize(dist.address, vemux.address, mux.address, 2 * week)
        await mux.grantRole(U.id("MINTER_ROLE"), dist.address)
        await dist.setRewardRate(toWei("0.1"))
        await manager.setPoolOwnedRate(toWei("0.5"))

        // week 1
        await setBlockTime(week)
        await mcb.mint(user0.address, toWei("10000"))
        await mcb.approve(vemux.address, toWei("10000"))
        await vemux.deposit(mcb.address, toWei("100"), week + year * 4)
        expect(await vemux.balanceOf(user0.address)).to.be.closeTo(toWei("100"), epsilon)
        expect(await tracker.callStatic.claimable(user0.address)).to.be.closeTo(toWei("0"), epsilon)

        await setBlockTime(week * 2)
        await vemux.deposit(mcb.address, toWei("100"), week + year * 4)

        await setBlockTime(week * 3)
        await vemux.deposit(mcb.address, toWei("100"), week + year * 4)

        // week +
        await setBlockTime(week * 10 + day * 3)
        await tracker.callStatic.claimable(user0.address)
    })

    it("mcb - reward from epoch0", async () => {
        // week 0
        await vemux.initialize(
            mcb.address,
            mux.address,
            "veMux",
            "veMux",
            18
        )
        await dist.initialize(mux.address, manager.address, bh.address, tracker.address, week)
        await tracker.initialize(dist.address, vemux.address, mux.address, week)
        await mux.grantRole(U.id("MINTER_ROLE"), dist.address)
        await dist.setRewardRate(toWei("0.1"))
        await manager.setPoolOwnedRate(toWei("0.5"))

        await setBlockTime(week * 5 + day)
        console.log(await dist.pendingRewards())

        // week 0+
        await setBlockTime(week * 5 + day)
        await mcb.mint(user0.address, toWei("100"))
        await mcb.approve(vemux.address, toWei("100"))
        await vemux.deposit(mcb.address, toWei("100"), week * 5 + day + year * 4)
        expect(await vemux.balanceOf(user0.address)).to.be.closeTo(toWei("100").mul(364 * 4 * 86400 - 86400).div(364 * 4 * 86400), epsilon)
        expect(await tracker.callStatic.claimable(user0.address)).to.be.closeTo(toWei("0"), epsilon)
        // week 0+
        await setBlockTime(week * 5 + day * 6)
        expect(await tracker.callStatic.claimable(user0.address)).to.be.closeTo(toWei("0"), epsilon)
        // week 1+
        await setBlockTime(week * 5 + day * 8)
        expect(await tracker.callStatic.claimable(user0.address)).to.be.closeTo(toWei("0"), epsilon)

        // // week 2+
        // await setBlockTime(week * 5 * 14)
        // console.log(await dist.pendingRewards())
        // expect(await tracker.callStatic.claimable(user0.address)).to.be.closeTo(toWei("30240"), epsilon)
    })
})
