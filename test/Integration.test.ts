import { ethers } from "hardhat"
import "@nomiclabs/hardhat-waffle"
import { expect } from "chai"
import { toWei, createContract, sleep } from "./deployUtils"
import { Contract } from "ethers"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
const U = ethers.utils
const B = ethers.BigNumber

describe("Integration", async () => {
    let user0: SignerWithAddress
    let user1: SignerWithAddress
    let user2: SignerWithAddress
    let user3: SignerWithAddress
    let vault: SignerWithAddress

    let zeroAddress = "0x0000000000000000000000000000000000000000"
    let epsilon = "1000000000"

    let weth: Contract
    let mcb: Contract
    let mux: Contract
    let mlp: Contract
    let vemux: Contract

    let mlpFeeTracker: Contract
    let mlpMuxTracker: Contract
    let mlpVester: Contract
    let veFeeTracker: Contract
    let veMuxTracker: Contract
    let muxVester: Contract
    let feeDist: Contract
    let muxDist: Contract

    let router: Contract
    let manager: Contract


    beforeEach(async () => {
        const accounts = await ethers.getSigners()
        user0 = accounts[0]
        user1 = accounts[1]
        user2 = accounts[2]
        user3 = accounts[3]
        vault = accounts[4]

        // tokens
        weth = await createContract("MockERC20", ["WETH", "WETH", 18])
        mcb = await createContract("MockERC20", ["MUX", "MUX", 18])
        mux = await createContract("Mux")
        await mux.initialize("Mux", "Mux")

        mlp = await createContract("MockERC20", ["MLP", "MLP", 18])

        // mlp staking suite
        // mlp -> fMLP -> sMLP
        mlpFeeTracker = await createContract("MlpRewardTracker")
        mlpMuxTracker = await createContract("MlpRewardTracker")
        mlpVester = await createContract("TestVester")
        router = await createContract("RewardRouter")
        // mcb staking suite
        vemux = await createContract("TestVotingEscrow")
        veFeeTracker = await createContract("TestMuxRewardTracker")
        veMuxTracker = await createContract("TestMuxRewardTracker")
        muxVester = await createContract("TestVester")
        feeDist = await createContract("TestFeeDistributor")
        muxDist = await createContract("TestMuxDistributor")

        await mux.grantRole(ethers.utils.id("MINTER_ROLE"), muxDist.address)
        await mux.grantRole(ethers.utils.id("MINTER_ROLE"), mlpVester.address)
        await mux.grantRole(ethers.utils.id("MINTER_ROLE"), muxVester.address)
        await mux.setHandler(vemux.address, true)
        await mux.setHandler(muxDist.address, true)
        await mux.setHandler(mlpMuxTracker.address, true)
        await mux.setHandler(veMuxTracker.address, true)
        await mux.setHandler(mlpVester.address, true)
        await mux.setHandler(muxVester.address, true)

        await vemux.initialize(
            mcb.address,
            mux.address,
            "veMux",
            "veMux",
            0
        )
        await feeDist.initialize(
            weth.address,
            router.address,
            mlpFeeTracker.address,
            veFeeTracker.address,
            toWei("0.5")
        )
        await muxDist.initialize(
            mux.address,
            router.address,
            mlpMuxTracker.address,
            veMuxTracker.address,
            86400 * 364
        )
        await mlpVester.initialize(
            "Vested MLP",
            "vMLP",
            86400 * 365,
            mux.address,    // estoken
            mlpMuxTracker.address, // stake
            mcb.address, // rewardtoken
            mlpMuxTracker.address, // tracker
            false,
        )
        await muxVester.initialize(
            "Vested MUX",
            "vMUX",
            86400 * 365,
            mux.address,
            zeroAddress, // stake
            mcb.address,
            veMuxTracker.address, // tracker
            true,
        )

        await mlpFeeTracker.initialize(
            "Fee MLP",
            "fMLP",
            [mlp.address],
            feeDist.address
        )
        await mlpMuxTracker.initialize(
            "Staked MLP",
            "sMLP",
            [mlpFeeTracker.address],
            muxDist.address
        )
        await veFeeTracker.initialize(
            feeDist.address,
            vemux.address,
            weth.address,
            86400 * 364
        )
        await veMuxTracker.initialize(
            muxDist.address,
            vemux.address,
            mux.address,
            86400 * 364
        )
        await mux.grantRole(U.id("MINTER_ROLE"), muxVester.address)

        await mlpFeeTracker.setHandler(router.address, true)
        await mlpFeeTracker.setHandler(mlpMuxTracker.address, true)
        await mlpMuxTracker.setHandler(router.address, true)
        await mlpVester.setHandler(router.address, true)
        await muxVester.setHandler(router.address, true)

        await router.initialize(
            [weth.address, mcb.address, mux.address, mlp.address, vemux.address],
            [mlpFeeTracker.address, mlpMuxTracker.address, veFeeTracker.address, veMuxTracker.address],
            [mlpVester.address, muxVester.address],
            [feeDist.address, muxDist.address],
        )

        veFeeTracker.setHandler(router.address, true);
        veMuxTracker.setHandler(router.address, true);
        mlpFeeTracker.setHandler(router.address, true);
        mlpMuxTracker.setHandler(router.address, true);
        vemux.setHandler(router.address, true);
        mlpVester.setHandler(router.address, true);
        muxVester.setHandler(router.address, true);
        mlpFeeTracker.setHandler(mlpMuxTracker.address, true);
        mlpMuxTracker.setHandler(mlpVester.address, true);

        await mux.grantRole(ethers.utils.id("MINTER_ROLE"), muxDist.address)
        await mux.grantRole(ethers.utils.id("MINTER_ROLE"), mlpVester.address)
        await mux.grantRole(ethers.utils.id("MINTER_ROLE"), muxVester.address)
        await mux.grantRole(ethers.utils.id("TRANSFERRABLE_ROLE"), vemux.address)
        await mux.grantRole(ethers.utils.id("TRANSFERRABLE_ROLE"), muxDist.address)
        await mux.grantRole(ethers.utils.id("TRANSFERRABLE_ROLE"), mlpMuxTracker.address)
        await mux.grantRole(ethers.utils.id("TRANSFERRABLE_ROLE"), veMuxTracker.address)
        await mux.grantRole(ethers.utils.id("TRANSFERRABLE_ROLE"), mlpVester.address)
        await mux.grantRole(ethers.utils.id("TRANSFERRABLE_ROLE"), muxVester.address)
        await mux.grantRole(ethers.utils.id("TRANSFERRABLE_ROLE"), vemux.address)

        await router.setVault(vault.address)
        await router.setProtocolLiquidityOwner(user3.address)
    })

    const setTime = async (n: Number) => {
        await vemux.setBlockTime(n)
        await feeDist.setBlockTime(n)
        await muxDist.setBlockTime(n)
        await veFeeTracker.setBlockTime(n)
        await veMuxTracker.setBlockTime(n)
        await mlpVester.setBlockTime(n)
        await muxVester.setBlockTime(n)
    }

    it("mlp stake 1", async () => {
        await mlp.mint(user0.address, toWei("10000"))
        await mlp.mint(user1.address, toWei("10000"))
        await mlp.mint(user3.address, toWei("200"))
        await mcb.mint(user0.address, toWei("10000"))
        await mux.mint(user0.address, toWei("10000"))

        const base = 86400 * 364;
        await setTime(base)
        // stake 100 mlp , mlp -> mlpFeeTracker -> muxFeeTracker
        await mlp.connect(user1).approve(mlpFeeTracker.address, toWei("10000"))
        await router.connect(user1).stakeMlp(toWei("100"))
        await mlp.approve(mlpFeeTracker.address, toWei("10000"))
        await router.stakeMlp(toWei("100"))

        // mcb
        await mcb.approve(vemux.address, toWei("10000"))
        await router.stakeMcb(toWei("200"), base + 86400 * 365 * 4)
        expect(await vemux.balanceOf(user0.address)).to.be.closeTo(toWei("200"), epsilon)

        expect(await mlpFeeTracker.balanceOf(user0.address)).to.equal(toWei("0"))
        expect(await mlpMuxTracker.balanceOf(user0.address)).to.equal(toWei("100"))

        await mux.mint(muxDist.address, toWei("50000000"))
        await weth.mint(user0.address, toWei("5000"))
        await weth.connect(user0).approve(feeDist.address, toWei("5000"))
        await feeDist.notifyReward(toWei("5000"))

        await setTime(base + 5 * 86400) // +5 days

        expect(await router.poolOwnedRate()).to.equal(toWei("0.5"))
        // 5000 * (1 - 0.5(por)) * 0.5(feeRate) * 0.5(share)
        expect(await mlpFeeTracker.callStatic.claimable(user0.address)).to.closeTo(
            B.from(toWei("5000")).div(2).div(2).div(2).mul(5).div(7),
            epsilon
        )
        // lock for 4 years
        await setTime(base + 14 * 86400) // +7 days
        expect(await mlpFeeTracker.callStatic.claimable(user0.address)).to.closeTo(
            B.from(toWei("5000")).div(2).div(2).div(2),
            epsilon
        )
        await mlpMuxTracker.updateRewards()

        await await mlpFeeTracker.claim(user0.address)

        await veFeeTracker.checkpointTotalSupply()
        await veMuxTracker.checkpointTotalSupply()

        console.log(await veFeeTracker.callStatic.claimable(user0.address))
        console.log(await veMuxTracker.callStatic.claimable(user0.address))
        console.log(await mlpMuxTracker.callStatic.claimable(user0.address))
    })

    it("mlp stake 2", async () => {
        await mlp.mint(user0.address, toWei("10000"))
        await mlp.mint(user1.address, toWei("10000"))
        await mlp.mint(user3.address, toWei("200"))
        await mcb.mint(user0.address, toWei("10000"))
        await mux.mint(user0.address, toWei("10000"))

        const base = 86400 * 364;

        await setTime(base)
        // stake 100 mlp , mlp -> mlpFeeTracker -> muxFeeTracker
        await mlp.connect(user1).approve(mlpFeeTracker.address, toWei("10000"))
        await router.connect(user1).stakeMlp(toWei("100"))
        await mlp.approve(mlpFeeTracker.address, toWei("10000"))
        await router.stakeMlp(toWei("100"))
        // mcb
        await mcb.approve(vemux.address, toWei("10000"))
        await router.stakeMcb(toWei("200"), base + 86400 * 365 * 4)
        expect(await vemux.balanceOf(user0.address)).to.be.closeTo(toWei("200"), epsilon)
        expect(await mlpFeeTracker.balanceOf(user0.address)).to.equal(toWei("0"))
        expect(await mlpMuxTracker.balanceOf(user0.address)).to.equal(toWei("100"))
        await mux.mint(muxDist.address, toWei("50000000"))
        await weth.mint(user0.address, toWei("5000"))
        await weth.connect(user0).approve(feeDist.address, toWei("5000"))
        await feeDist.notifyReward(toWei("5000"))

        await setTime(base + 5 * 86400) // +5 days
        console.log(await router.poolOwnedRate())
        console.log(await router.votingEscrowedRate())
        console.log(await muxDist.pendingMlpRewards())
        console.log(await mlpMuxTracker.callStatic.claimable(user0.address)) // 5 天
        await router.claimFromMlp()
        // 2000 * 5 * 0.5  
        await mux.approve(mlpVester.address, toWei("100000"))
        await router.depositToMlpVester(toWei("1000"))
        expect(await mlpVester.balanceOf(user0.address)).to.equal(toWei("1000"))

        await setTime(base + 8 * 86400)
        expect(await mlpVester.claimable(user0.address)).to.equal(toWei("1000").mul(3).div(365))
        expect(await mlpVester.claimedAmounts(user0.address)).to.equal(toWei("0"))
        expect(await mlpVester.cumulativeClaimAmounts(user0.address)).to.equal(toWei("0"))

        expect(await router.claimableVestedTokenFromMlp(user0.address)).to.equal(toWei("1000").mul(3).div(365))
        expect(await router.claimedVestedTokenFromMlp(user0.address)).to.equal(toWei("0"))

        await setTime(base + 10 * 86400)
        await mux.approve(vemux.address, toWei("10000"))
        await router.compound()

        await setTime(base + 12 * 86400)
        await mcb.mint(mlpVester.address, toWei("100000"))
        await mcb.mint(muxVester.address, toWei("100000"))

    })
})