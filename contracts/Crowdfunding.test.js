// The following code is a test suite for a Crowdfunding smart contract using the Truffle framework.
// OpenZeppelin’s test helpers are utilized to manipulate and control blockchain time during tests.
// Mocha is used as the testing framework, and the assert library verifies expected outcomes.

// Load the Crowdfunding smart contract artifact, which allows us to interact with the compiled contract in the tests.
const Crowdfunding = artifacts.require("Crowdfunding");

// Import OpenZeppelin's time helper utilities, which include functions for advancing time and checking time in tests.
const { time } = require('@openzeppelin/test-helpers');

// Define the test suite for the Crowdfunding contract. The contract() function is provided by Truffle to define test cases.
// The accounts parameter represents an array of available Ethereum addresses provided by Ganache or the connected blockchain.
contract("Crowdfunding", (accounts) => {

    // Declare a variable to hold the deployed instance of the Crowdfunding contract.
    let crowdfunding;

    // Destructure the first three accounts from the accounts array into separate variables for convenience.
    // These accounts will be used as the campaign creator and contributors.
    const [creator, contributor1, contributor2] = accounts;

    // The beforeEach() function runs before each test case in the suite.
    // It deploys a new instance of the Crowdfunding contract before each test to ensure a clean state.
    beforeEach(async () => {
        crowdfunding = await Crowdfunding.new();
    });

    // Test case: Verify that a campaign can be created successfully.
    it("should create a campaign", async () => {
        // Define the campaign goal as 1 ether, converted to Wei (the smallest unit of ether).
        // Converts a value from a specified unit to Wei (the smallest unit of Ether)
        const goal = web3.utils.toWei("1", "ether");

        // Define the campaign duration as 86400 seconds (equivalent to 1 day).
        const duration = 86400;

        // Call the createCampaign function on the Crowdfunding contract to create a new campaign.
        // Specify the goal, duration, and the creator's address as the sender.
        await crowdfunding.createCampaign(goal, duration, { from: creator });

        // Retrieve the campaign details for the campaign with ID 1.
        const campaign = await crowdfunding.getCampaign(1);

        // Assert that the campaign's creator matches the expected creator address.
        assert.equal(campaign.creator, creator, "Campaign creator is incorrect");

        // Assert that the campaign's goal matches the expected goal (in Wei).
        assert.equal(campaign.goal.toString(), goal, "Campaign goal is incorrect");

        // Assert that the campaign's pledged amount is initially 0.
        assert.equal(campaign.pledged.toString(), '0', "Campaign pledged amount should be 0");

        // Assert that the campaign is not marked as completed upon creation.
        assert.equal(campaign.completed, false, "Campaign should not be completed");
    });

    // Test case: Verify that contributions can be made to a campaign.
    it("should allow contributions", async () => {
        // Define the campaign goal and duration as before.
        const goal = web3.utils.toWei("1", "ether");
        const duration = 86400; // 1 day in seconds

        // Create the campaign with the specified goal and duration.
        // pause the execution of the function until the createCampaign function 
        await crowdfunding.createCampaign(goal, duration, { from: creator });

        // Define the contribution amount as 0.5 ether, converted to Wei.
        const contribution = web3.utils.toWei("0.5", "ether");

        // Call the contribute function on the Crowdfunding contract to contribute to the campaign with ID 1.
        // Specify the contribution amount and the contributor's address as the sender.
        await crowdfunding.contribute(1, { from: contributor1, value: contribution });

        // Retrieve the updated campaign details for the campaign with ID 1.
        const campaign = await crowdfunding.getCampaign(1);

        // Retrieve the contribution amount for contributor1 to the campaign with ID 1.
        const contributionAmount = await crowdfunding.getContribution(1, contributor1);

        // Assert that the campaign's pledged amount matches the expected contribution.
        assert.equal(campaign.pledged.toString(), contribution, "Campaign pledged amount is incorrect");

        // Assert that the contribution amount recorded for contributor1 matches the expected contribution.
        assert.equal(contributionAmount.toString(), contribution, "Contributor's contribution is incorrect");
    });

    // Test case: Verify that the campaign creator can withdraw funds if the campaign goal is met.
    it("should allow withdrawal if the goal is met", async () => {
        // Define the campaign goal and duration as before.
        const goal = web3.utils.toWei("1", "ether");
        const duration = 86400; // 1 day in seconds

        // Create the campaign with the specified goal and duration.
        await crowdfunding.createCampaign(goal, duration, { from: creator });

        // Define the contribution amount as 1 ether, converted to Wei.
        const contribution = web3.utils.toWei("1", "ether");

        // Contribute the full amount needed to meet the campaign goal.
        await crowdfunding.contribute(1, { from: contributor1, value: contribution });

        // Advance time to just after the campaign deadline.
        await time.increase(duration + 1000); // 1 day + 1 second

        // Get the initial balance of the campaign creator before the withdrawal.
        // Converts a value to a BigNumber (BN) object, which is used for handling large numbers (such as Ether amounts)
        const initialBalance = web3.utils.toBN(await web3.eth.getBalance(creator));

        // Call the withdrawFunds function to withdraw the funds from the campaign with ID 1.
        await crowdfunding.withdrawFunds(1, { from: creator });

        // Retrieve the updated campaign details for the campaign with ID 1.
        const campaign = await crowdfunding.getCampaign(1);

        // Get the final balance of the campaign creator after the withdrawal.
        const finalBalance = web3.utils.toBN(await web3.eth.getBalance(creator));

        // Assert that the campaign is marked as completed after the withdrawal.
        assert.equal(campaign.completed, true, "Campaign should be marked as completed");

        // Assert that the final balance of the creator is greater than the initial balance, indicating successful withdrawal.
        // Checks if one BN value is greater than another
        assert(finalBalance.gt(initialBalance), "Creator's balance should have increased");
    });

    // Test case: Verify that the campaign creator cannot withdraw funds if the campaign goal is not met.
    it("should fail to withdraw funds if the goal is not met", async () => {
        // Define the campaign goal as 2 ether (which will not be met) and the duration as before.
        const goal = web3.utils.toWei("2", "ether");
        const duration = 86400; // 1 day in seconds

        // Create the campaign with the specified goal and duration.
        await crowdfunding.createCampaign(goal, duration, { from: creator });

        // Define the contribution amount as 1 ether, converted to Wei.
        const contribution = web3.utils.toWei("1", "ether");

        // Contribute an amount that does not meet the campaign goal.
        await crowdfunding.contribute(1, { from: contributor1, value: contribution });

        // Advance time to just after the campaign deadline.
        await time.increase(duration + 1000); // 1 day + 1 second

        // Attempt to withdraw the funds, which should fail because the goal wasn't met.
        try {
            await crowdfunding.withdrawFunds(1, { from: creator });
            assert.fail("Expected withdraw to fail because goal wasn't met");
        } catch (error) {
            // Assert that the error message contains the expected "Goal not reached" message.
            assert(error.message.includes("Goal not reached"), `Expected "Goal not reached" but got ${error.message}`);
        }
    });

    // Test case: Verify that contributors can be refunded if the campaign fails to meet its goal.
    it("should refund contributions if the campaign failed", async () => {
        // Define the campaign goal as 2 ether and the duration as before.
        const goal = web3.utils.toWei("2", "ether");
        const duration = 86400; // 1 day in seconds
    
        // Create the campaign with the specified goal and duration.
        await crowdfunding.createCampaign(goal, duration, { from: creator });
    
        // Define the contribution amount as 1 ether, converted to Wei.
        const contribution = web3.utils.toWei("1", "ether");
        await crowdfunding.contribute(1, { from: contributor1, value: contribution });
    
        // Advance time to just after the campaign deadline.
        await time.increase(duration + 1000); // 1 day + 1 second
    
        // Get the initial balance of the contributor before the refund.
        const initialBalance = web3.utils.toBN(await web3.eth.getBalance(contributor1));
    
        // Call the refund function to refund the contribution made by contributor1 to the campaign with ID 1.
        await crowdfunding.refund(1, { from: contributor1 });
    
        // Get the new balance of the contributor after the refund.
        const newBalance = web3.utils.toBN(await web3.eth.getBalance(contributor1));
        
        // Calculate the expected refund amount.
        const expectedRefundAmount = web3.utils.toBN(contribution);
        
        // Calculate the actual refund amount by subtracting the initial balance from the new balance.
        // Subtracts one BN value from another.
        const actualRefundAmount = newBalance.sub(initialBalance);
    
        // Allow for a small margin of error due to gas costs during the refund transaction.
        const marginOfError = web3.utils.toBN(web3.utils.toWei("0.01", "ether"));
        
        // Assert that the actual refund amount is within the expected range (considering the margin of error).
        // Checks if one BN value is greater than or equal to another / Checks if one BN value is less than or equal to another.
        assert(actualRefundAmount.gte(expectedRefundAmount.sub(marginOfError)) && actualRefundAmount.lte(expectedRefundAmount.add(marginOfError)),
               `Refund amount is not as expected. Expected ${expectedRefundAmount.toString()} but got ${actualRefundAmount.toString()}`);
    });

    // Test case: Verify that the correct campaign status is returned based on time and campaign progress.
    it('should return the correct campaign status', async () => {
        // Define the campaign goal as 1 ether and the duration as 1 hour (3600 seconds).
        const goal = web3.utils.toWei('1', 'ether');
        const duration = 3600; // 1 hour

        // Create the campaign with the specified goal and duration.
        await crowdfunding.createCampaign(goal, duration, { from: creator });

        // Retrieve the campaign status before the deadline (should be "Active").
        const statusBeforeDeadline = await crowdfunding.getStatus(1);
        // Asserts that two values are equal.
        assert.equal(statusBeforeDeadline, 'Active');

        // Advance time to just after the campaign deadline.
        await time.increase(duration + 1000); // 1 hour + 1 second

        // Retrieve the campaign status after the deadline (should be "Failed").
        const statusAfterDeadline = await crowdfunding.getStatus(1);
        assert.equal(statusAfterDeadline, 'Failed');
    });
});
