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
    let year = 365 * 86400

    let mux: Contract
    let esmux: Contract
    let tracker: Contract
    let vester: Contract

    before(async () => {
        const accounts = await ethers.getSigners()
        user0 = accounts[0]
        user1 = accounts[1]
        user2 = accounts[2]
        user3 = accounts[3]
    })

    beforeEach(async () => {
        mux = await createContract("MockERC20", ["MUX", "MUX", 18])
        esmux = await createContract("MockERC20", ["ESMUX", "ESMUX", 18])
        tracker = await createContract("MockTracker")
        vester = await createContract("TestVester")

        await esmux.grantRole(U.id("MINTER_ROLE"), vester.address)
    })

    const setBlockTime = async (n: Number) => {
        await vester.setBlockTime(n)
    }

    it("mlp - no pair token", async () => {
        await vester.initialize(
            "vMUX",
            "vestedMux",
            86400 * 365 * 4,
            esmux.address,
            zeroAddress,
            mux.address,
            tracker.address,
            false,
        )

        await mux.mint(vester.address, toWei("1000000"))
        await tracker.setCumulativeRewards(user0.address, toWei("200"))
        await tracker.setAverageStakedAmounts(user0.address, toWei("1000"))

        expect(await vester.getMaxVestableAmount(user0.address)).to.equal(toWei("200"))
        expect(await vester.getCombinedAverageStakedAmount(user0.address)).to.equal(toWei("1000"))

        await setBlockTime(86400 * 364)
        await esmux.mint(user0.address, toWei("1000"))
        await esmux.approve(vester.address, toWei("1000"))
        await vester.deposit(toWei("100"))

        // static
        expect(await vester.getTotalVested(user0.address)).to.equal(toWei("100"))
        expect(await vester.balanceOf(user0.address)).to.equal(toWei("100"))
        expect(await vester.getVestedAmount(user0.address)).to.equal(toWei("100"))
        expect(await vester.claimable(user0.address)).to.equal(toWei("0"))

        await setBlockTime(86400 * 364 + year * 1)
        // static
        expect(await vester.getTotalVested(user0.address)).to.equal(toWei("100"))
        expect(await vester.balanceOf(user0.address)).to.equal(toWei("100"))
        expect(await vester.getVestedAmount(user0.address)).to.equal(toWei("100"))
        expect(await vester.claimable(user0.address)).to.equal(toWei("25"))

        await vester.claim()
        expect(await vester.getTotalVested(user0.address)).to.equal(toWei("100"))
        expect(await vester.balanceOf(user0.address)).to.equal(toWei("75"))
        expect(await vester.getVestedAmount(user0.address)).to.equal(toWei("100"))
        expect(await vester.claimable(user0.address)).to.equal(toWei("0"))
        expect(await mux.balanceOf(user0.address)).to.equal(toWei("25"))

        await setBlockTime(86400 * 364 + year * 4)
        await vester.withdraw()
        expect(await vester.getTotalVested(user0.address)).to.equal(toWei("0"))
        expect(await vester.balanceOf(user0.address)).to.equal(toWei("0"))
        expect(await vester.getVestedAmount(user0.address)).to.equal(toWei("0"))
        expect(await vester.claimable(user0.address)).to.equal(toWei("0"))
        expect(await mux.balanceOf(user0.address)).to.equal(toWei("100"))
    })


    it("mlp - with pair token", async () => {
        const pair = await createContract("MockERC20", ["PAIR", "PAIR", 18])

        await vester.initialize(
            "vMUX",
            "vestedMux",
            86400 * 365 * 4,
            esmux.address,
            pair.address,
            mux.address,
            tracker.address,
            false,
        )

        await mux.mint(vester.address, toWei("1000000"))
        await tracker.setCumulativeRewards(user0.address, toWei("200"))
        await tracker.setAverageStakedAmounts(user0.address, toWei("1000"))

        expect(await vester.getMaxVestableAmount(user0.address)).to.equal(toWei("200"))
        expect(await vester.getCombinedAverageStakedAmount(user0.address)).to.equal(toWei("1000"))

        await setBlockTime(86400 * 364)
        await pair.mint(user0.address, toWei("2000"))
        await pair.approve(vester.address, toWei("2000"))
        await esmux.mint(user0.address, toWei("1000"))
        await esmux.approve(vester.address, toWei("1000"))
        await vester.deposit(toWei("100"))

        // static
        expect(await vester.getTotalVested(user0.address)).to.equal(toWei("100"))
        expect(await vester.balanceOf(user0.address)).to.equal(toWei("100"))
        expect(await vester.getVestedAmount(user0.address)).to.equal(toWei("100"))
        expect(await vester.claimable(user0.address)).to.equal(toWei("0"))
        expect(await vester.pairAmounts(user0.address)).to.equal(toWei("500")) // 100 / 200 * 1000

        await setBlockTime(86400 * 364 + year * 1)
        await tracker.setAverageStakedAmounts(user0.address, toWei("1500"))
        await vester.deposit(toWei("100"))
        // static
        expect(await vester.getTotalVested(user0.address)).to.equal(toWei("200"))
        expect(await vester.balanceOf(user0.address)).to.equal(toWei("175"))
        expect(await vester.getVestedAmount(user0.address)).to.equal(toWei("200"))
        expect(await vester.claimable(user0.address)).to.equal(toWei("25"))
        expect(await vester.pairAmounts(user0.address)).to.equal(toWei("1312.5"))  // 175 / 200 * 1500

        await vester.claim()
        expect(await vester.getTotalVested(user0.address)).to.equal(toWei("200"))
        expect(await vester.balanceOf(user0.address)).to.equal(toWei("175"))
        expect(await vester.getVestedAmount(user0.address)).to.equal(toWei("200"))
        expect(await vester.claimable(user0.address)).to.equal(toWei("0"))
        expect(await mux.balanceOf(user0.address)).to.equal(toWei("25"))
        expect(await vester.pairAmounts(user0.address)).to.equal(toWei("1312.5"))

        await setBlockTime(86400 * 364 + year * 5)
        await vester.withdraw()
        expect(await vester.getTotalVested(user0.address)).to.equal(toWei("0"))
        expect(await vester.balanceOf(user0.address)).to.equal(toWei("0"))
        expect(await vester.getVestedAmount(user0.address)).to.equal(toWei("0"))
        expect(await vester.claimable(user0.address)).to.equal(toWei("0"))
        expect(await mux.balanceOf(user0.address)).to.equal(toWei("200"))
        expect(await pair.balanceOf(user0.address)).to.equal(toWei("2000"))
    })

    it("mlp - no pair token, limit volume", async () => {
        await vester.initialize(
            "vMUX",
            "vestedMux",
            86400 * 365 * 4,
            esmux.address,
            zeroAddress,
            mux.address,
            tracker.address,
            true,
        )

        await mux.mint(vester.address, toWei("1000000"))
        await tracker.setCumulativeRewards(user0.address, toWei("200"))
        await tracker.setAverageStakedAmounts(user0.address, toWei("1000"))

        expect(await vester.getMaxVestableAmount(user0.address)).to.equal(toWei("200"))
        expect(await vester.getCombinedAverageStakedAmount(user0.address)).to.equal(toWei("1000"))

        await setBlockTime(86400 * 364)
        await esmux.mint(user0.address, toWei("1000"))
        await esmux.approve(vester.address, toWei("1000"))
        await vester.deposit(toWei("100"))
        expect(await vester.getMaxVestableAmount(user0.address)).to.equal(toWei("200"))

        await setBlockTime(86400 * 364 + year)
        expect(await vester.getMaxVestableAmount(user0.address)).to.equal(toWei("200"))
        await vester.claim()
        expect(await vester.getMaxVestableAmount(user0.address)).to.equal(toWei("175"))

        await setBlockTime(86400 * 364 + year * 2)
        expect(await vester.getMaxVestableAmount(user0.address)).to.equal(toWei("175"))
        await vester.withdraw()
        expect(await mux.balanceOf(user0.address)).to.equal(toWei("50"))
        expect(await vester.getMaxVestableAmount(user0.address)).to.equal(toWei("150"))

        await setBlockTime(86400 * 364 + year * 3) // 3 - 7
        expect(await vester.claimable(user0.address)).to.equal(toWei("0"))
        await vester.deposit(toWei("100"))
        expect(await vester.claimable(user0.address)).to.equal(toWei("0"))

        await setBlockTime(86400 * 364 + year * 4)
        expect(await vester.claimable(user0.address)).to.equal(toWei("25"))

        await expect(vester.deposit(toWei("51"))).to.be.revertedWith("max vestable amount exceeded")
        await vester.claim()

        expect(await vester.getMaxVestableAmount(user0.address)).to.equal(toWei("125"))
        expect(await vester.getTotalVested(user0.address)).to.equal(toWei("100"))
        await vester.deposit(toWei("25"))
        expect(await vester.getMaxVestableAmount(user0.address)).to.equal(toWei("125"))

    })

})
