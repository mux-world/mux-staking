import { ethers } from "hardhat"
import "@nomiclabs/hardhat-waffle"
import { expect } from "chai"
import { toWei, createContract, sleep } from "./deployUtils"
import { BigNumber, Contract } from "ethers"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
const U = ethers.utils
const B = ethers.BigNumber

describe("VotingEscrow", async () => {
    let user0: SignerWithAddress
    let user1: SignerWithAddress
    let user2: SignerWithAddress
    let user3: SignerWithAddress
    let router: SignerWithAddress

    let ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
    let YEAR = 365 * 86400
    let WEEK = 7 * 86400
    let EPSILON = "1000000000"

    let votingEscrow: Contract
    let mux: Contract
    let esmux: Contract

    beforeEach(async () => {
        const accounts = await ethers.getSigners()
        user0 = accounts[0]
        user1 = accounts[1]
        user2 = accounts[2]
        user3 = accounts[3]
        router = accounts[4]

        mux = await createContract("MockERC20", ["MUX", "MUX", 18])
        esmux = await createContract("MockERC20", ["esMUX", "esMUX", 18])
        votingEscrow = await createContract("TestVotingEscrow")
        await votingEscrow.initialize(
            mux.address,
            esmux.address,
            "veMux",
            "veMux",
            18
        )
    })

    const setTime = async (n: Number) => {
        await votingEscrow.setBlockTime(n)
    }

    const yearSeconds = (y: number) => {
        return YEAR * y - 86400 * y
    }

    const alignedYearSeconds = (y: number) => {
        return B.from(YEAR * y).div(WEEK).mul(WEEK).toNumber()
    }


    const balance = (b: BigNumber) => {
        return b.div(365).mul(364)
    }

    it("averageUnlockTime - single", async () => {
        await mux.mint(user0.address, toWei("1000"))
        await mux.approve(votingEscrow.address, toWei("1000"))

        await setTime(86400 * 364)
        // 4y = 100
        await votingEscrow.deposit(mux.address, toWei("100"), 86400 * 364 + yearSeconds(1))
        expect(await votingEscrow.balanceOf(user0.address)).to.be.closeTo(balance(toWei("25")), EPSILON)
        expect(await votingEscrow.averageUnlockTime()).to.equal(86400 * 364 + alignedYearSeconds(1))
        // 1y = 25
        await votingEscrow.increaseUnlockTime(86400 * 364 + yearSeconds(4))
        expect(await votingEscrow.balanceOf(user0.address)).to.be.closeTo(balance(toWei("100")), EPSILON)
        expect(await votingEscrow.averageUnlockTime()).to.equal(86400 * 364 + alignedYearSeconds(4))
        // 4y

        await setTime(86400 * 364 + yearSeconds(1))
        // 3y + 4y
        await votingEscrow.deposit(mux.address, toWei("100"), 86400 * 364 + yearSeconds(5))
        expect(await votingEscrow.averageUnlockTime()).to.equal(86400 * 364 + alignedYearSeconds(5))
    })

    it("averageUnlockTime - two", async () => {
        await mux.mint(user0.address, toWei("1000"))
        await mux.approve(votingEscrow.address, toWei("1000"))
        await mux.mint(user1.address, toWei("1000"))
        await mux.connect(user1).approve(votingEscrow.address, toWei("1000"))

        await setTime(86400 * 364)
        // 4y = 100
        await votingEscrow.deposit(mux.address, toWei("100"), 86400 * 364 + yearSeconds(4))
        expect(await votingEscrow.balanceOf(user0.address)).to.be.closeTo(balance(toWei("100")), EPSILON)
        expect(await votingEscrow.averageUnlockTime()).to.equal(86400 * 364 + alignedYearSeconds(4))

        await setTime(86400 * 364 + yearSeconds(1))
        // 3y + 4y
        await votingEscrow.connect(user1).deposit(mux.address, toWei("100"), 86400 * 364 + yearSeconds(5))
        expect(await votingEscrow.averageUnlockTime()).to.equal(86400 * 364 + alignedYearSeconds(4.5))

        await votingEscrow.deposit(mux.address, toWei("100"), 86400 * 364 + yearSeconds(5))
        expect(await votingEscrow.averageUnlockTime()).to.equal(86400 * 364 + alignedYearSeconds(5))
    })

    it("deposit1", async () => {
        await mux.mint(user0.address, toWei("1000"))
        await mux.approve(votingEscrow.address, toWei("1000"))
        await esmux.mint(user0.address, toWei("1000"))
        await esmux.approve(votingEscrow.address, toWei("1000"))

        await setTime(86400 * 364)
        // 4y = 100
        await votingEscrow.deposit(mux.address, toWei("100"), 86400 * 364 + yearSeconds(4))
        expect(await votingEscrow.balanceOf(user0.address)).to.be.closeTo(balance(toWei("100")), EPSILON)
        expect(await votingEscrow.averageUnlockTime()).to.equal(86400 * 364 + alignedYearSeconds(4))
        // 1y = 25
        await votingEscrow.deposit(mux.address, toWei("25"), 86400 * 364 + yearSeconds(4))

        await votingEscrow.deposit(esmux.address, toWei("100"), 86400 * 364 + yearSeconds(4))

        await votingEscrow.deposit(esmux.address, toWei("25"), 86400 * 364 + yearSeconds(4))
        expect(await votingEscrow.balanceOf(user0.address)).to.be.closeTo(balance(toWei("250")), EPSILON)
        expect(await votingEscrow.averageUnlockTime()).to.equal(86400 * 364 + alignedYearSeconds(4))
        // 126144000 * 100 + 25 * 126144000 / 125

        expect(await mux.balanceOf(user0.address)).to.equal(toWei("875"))
        expect(await esmux.balanceOf(user0.address)).to.equal(toWei("875"))

        expect(await votingEscrow.lockedAmount(user0.address)).to.equal(toWei("250"))

        // 2y
        await setTime(86400 * 364 + yearSeconds(2))
        await expect(votingEscrow.withdraw()).to.be.revertedWith("The lock didn't expire")
        expect(await votingEscrow.balanceOf(user0.address)).to.be.closeTo(balance(toWei("125")), EPSILON)

        await setTime(86400 * 364 + yearSeconds(4))
        await votingEscrow.withdraw()

        expect(await mux.balanceOf(user0.address)).to.equal(toWei("1000"))
        expect(await esmux.balanceOf(user0.address)).to.equal(toWei("1000"))
    })

    it("deposit2", async () => {
        await mux.mint(user0.address, toWei("1000"))
        await mux.approve(votingEscrow.address, toWei("1000"))

        await setTime(86400 * 364)
        // 4y = 100
        await votingEscrow.deposit(mux.address, toWei("100"), 86400 * 364 + yearSeconds(2))
        expect(await votingEscrow.balanceOf(user0.address)).to.be.closeTo(balance(toWei("50")), EPSILON)
        await votingEscrow.increaseUnlockTime(86400 * 364 + yearSeconds(4))
        expect(await votingEscrow.balanceOf(user0.address)).to.be.closeTo(toWei("100"), toWei("0.5"))
    })

    it("deposit4", async () => {
        await mux.mint(user0.address, toWei("1000"))
        await mux.approve(votingEscrow.address, toWei("1000"))
        await mux.mint(user1.address, toWei("1000"))
        await mux.connect(user1).approve(votingEscrow.address, toWei("1000"))

        await setTime(86400 * 364)
        // 4y = 100
        await votingEscrow.deposit(mux.address, toWei("100"), 86400 * 364 + yearSeconds(4))
        expect(await votingEscrow.balanceOf(user0.address)).to.be.closeTo(balance(toWei("100")), EPSILON)
        // 3y = 75
        await setTime(86400 * 364 + yearSeconds(1))
        expect(await votingEscrow.balanceOf(user0.address)).to.be.closeTo(balance(toWei("75")), EPSILON)
        await votingEscrow.connect(user1).deposit(mux.address, toWei("100"), 86400 * 364 + yearSeconds(5))
        expect(await votingEscrow.balanceOf(user1.address)).to.be.closeTo(balance(toWei("100")), EPSILON)
        expect(await votingEscrow.totalSupply()).to.be.closeTo(balance(toWei("175")), EPSILON)
    })

    it("deposit5", async () => {
        await mux.mint(user0.address, toWei("1000"))
        await mux.approve(votingEscrow.address, toWei("1000"))
        await esmux.mint(user0.address, toWei("1000"))
        await esmux.approve(votingEscrow.address, toWei("1000"))

        await setTime(86400 * 364)
        // 4y = 100
        await votingEscrow.deposit(mux.address, toWei("100"), 86400 * 364 + yearSeconds(4))
        expect(await votingEscrow.balanceOf(user0.address)).to.be.closeTo(balance(toWei("100")), EPSILON)
        expect(await votingEscrow.averageUnlockTime()).to.equal(86400 * 364 + yearSeconds(4))
        expect(await votingEscrow.depositedBalances(user0.address)).to.deep.equal([toWei("100"), toWei("0")])
        // 1y = 25
        await votingEscrow.deposit(esmux.address, toWei("25"), 86400 * 364 + yearSeconds(4))
        expect(await votingEscrow.balanceOf(user0.address)).to.be.closeTo(balance(toWei("125")), EPSILON)
        expect(await votingEscrow.averageUnlockTime()).to.equal(86400 * 364 + yearSeconds(4))
        expect(await votingEscrow.depositedBalances(user0.address)).to.deep.equal([toWei("100"), toWei("25")])
        // 126144000 * 100 + 25 * 126144000 / 125

        expect(await votingEscrow.lockedAmount(user0.address)).to.equal(toWei("125"))

        // 2y
        await setTime(86400 * 364 + yearSeconds(2))
        await expect(votingEscrow.withdraw()).to.be.revertedWith("The lock didn't expire")
        expect(await votingEscrow.balanceOf(user0.address)).to.be.closeTo(balance(toWei("62.5")), EPSILON)

        await setTime(86400 * 364 + YEAR * 4)
        await expect(votingEscrow.withdraw())
        expect(await votingEscrow.depositedBalances(user0.address)).to.deep.equal([toWei("0"), toWei("0")])
        expect(await mux.balanceOf(user0.address)).to.equal(toWei("1000"))
        expect(await esmux.balanceOf(user0.address)).to.equal(toWei("1000"))
    })

    it("deposit6", async () => {
        await mux.mint(user0.address, toWei("1000"))
        await mux.approve(votingEscrow.address, toWei("1000"))

        await setTime(1683388800 - 86400 * 365)

        console.log(await votingEscrow.userPointEpoch(user0.address))
        await votingEscrow.deposit(mux.address, toWei("10"), 1683388800)
        console.log(await votingEscrow.userPointEpoch(user0.address))
        await votingEscrow.increaseUnlockTime(1683648000)
        console.log(await votingEscrow.userPointEpoch(user0.address))
    })
})


    // (75 * 365 * 86400 * 3 + 100 * 365 * 86400 * 4) / 175