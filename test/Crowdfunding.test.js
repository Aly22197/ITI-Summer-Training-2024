const Crowdfunding = artifacts.require("Crowdfunding");

contract("Crowdfunding", accounts => {
    let crowdfunding;

    before(async () => {
        crowdfunding = await Crowdfunding.deployed();
    });

    it("should create a campaign", async () => {
        const goal = web3.utils.toWei("1", "ether");
        const duration = 86400; // 1 day in seconds

        await crowdfunding.createCampaign(goal, duration, { from: accounts[0] });

        const campaign = await crowdfunding.campaigns(1);
        console.log("Campaign details:", campaign);
        console.log("Campaign deadline:", campaign.deadline.toString());

        assert.equal(campaign.creator, accounts[0], "Campaign creator is incorrect");
        assert.equal(campaign.goal.toString(), goal, "Campaign goal is incorrect");
        assert.equal(campaign.pledged.toString(), '0', "Campaign pledged amount should be 0");
        assert.equal(campaign.completed, false, "Campaign should not be completed");
    });

    it("should allow contributions", async () => {
        const contribution = web3.utils.toWei("1", "ether");

        await crowdfunding.contribute(1, { from: accounts[1], value: contribution });

        const campaign = await crowdfunding.campaigns(1);

        assert.equal(campaign.pledged.toString(), contribution, "Campaign pledged amount is incorrect");
    });

    it("should allow withdrawal if the goal is met", async () => {
        const goal = web3.utils.toWei("1", "ether");
        const duration = 86400; // 1 day in seconds

        await crowdfunding.createCampaign(goal, duration, { from: accounts[0] });
        const contribution = web3.utils.toWei("1", "ether");

        await crowdfunding.contribute(2, { from: accounts[1], value: contribution });

        // Increase time to after the campaign deadline
        await increaseTime(duration + 1000); // 1 day + 1 second

        const initialBalance = web3.utils.toBN(await web3.eth.getBalance(accounts[0]));

        await crowdfunding.withdrawFunds(2, { from: accounts[0] });

        const campaign = await crowdfunding.campaigns(2);
        const finalBalance = web3.utils.toBN(await web3.eth.getBalance(accounts[0]));

        assert(campaign.completed, "Campaign should be marked as completed");
        assert(finalBalance.gt(initialBalance), "Creator's balance should have increased");
    });

    it("should fail to withdraw funds if the goal is not met", async () => {
        const goal = web3.utils.toWei("2", "ether");
        const duration = 86400; // 1 day in seconds
    
        await crowdfunding.createCampaign(goal, duration, { from: accounts[0] });
    
        const contribution = web3.utils.toWei("1", "ether");
    
        await crowdfunding.contribute(1, { from: accounts[1], value: contribution });
    
        const campaign = await crowdfunding.campaigns(1);
        console.log("Campaign deadline:", campaign.deadline.toString());
    
        await increaseTime(duration + 1000); // 1 day + 1 second
    
        try {
            await crowdfunding.withdrawFunds(1, { from: accounts[0] });
            assert.fail("Expected withdraw to fail because goal wasn't met");
        } catch (error) {
            assert(error.message.includes("Goal not reached"), `Expected "Goal not reached" but got ${error.message}`);
        }
    });
      
    it("should return the correct campaign status", async () => {
        const goal = web3.utils.toWei("1", "ether");
        const duration = 86400; // 1 day in seconds
    
        await crowdfunding.createCampaign(goal, duration, { from: accounts[0] });
    
        // Check initial status (should be Active)
        let status = await crowdfunding.getStatus(1);
        console.log("Initial status:", status);
        assert.equal(status, "Active", "Status should be Active");
    
        // Advance time to after the campaign deadline
        await increaseTime(duration + 1000); // 1 day + 1 second
    
        // Check status after deadline (should be Failed if goal not met)
        status = await crowdfunding.getStatus(1);
        console.log("Status after deadline:", status);
        assert.equal(status, "Failed", "Status should be Failed if goal not met");
    
        // Contribute to the campaign to meet the goal
        const contribution = web3.utils.toWei("1", "ether");
        await crowdfunding.contribute(1, { from: accounts[1], value: contribution });
    
        // Withdraw funds
        await crowdfunding.withdrawFunds(1, { from: accounts[0] });
    
        // Check status after successful withdrawal (should be Completed)
        status = await crowdfunding.getStatus(1);
        console.log("Status after withdrawal:", status);
        assert.equal(status, "Completed", "Status should be Completed after successful withdrawal");
    });
    
    // Helper function to increase blockchain time
    async function increaseTime(seconds) {
        await web3.currentProvider.send({
            jsonrpc: "2.0",
            method: "evm_increaseTime",
            params: [seconds],
            id: new Date().getTime()
        }, (err, res) => {
            if (err) console.error(err);
        });

        await web3.currentProvider.send({
            jsonrpc: "2.0",
            method: "evm_mine",
            params: [],
            id: new Date().getTime()
        }, (err, res) => {
            if (err) console.error(err);
        });

        // Log current block time to verify
        const currentBlock = await web3.eth.getBlock('latest');
        console.log('Current block time:', currentBlock.timestamp);
    }
});
