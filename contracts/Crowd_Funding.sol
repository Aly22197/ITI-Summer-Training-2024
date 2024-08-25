// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Crowd_Funding {

    struct Post {
        address payable creator;
        uint256 goalAmount;
        uint256 deadline;
        uint256 collectedAmount;
        uint256 minContribution;
        bool active;
        address[] contributors; // To track all contributors
        mapping(address => uint256) contributions;
    }

    mapping(uint256 => Post) public posts;
    uint256 public postCount;

    event PostCreated(uint256 indexed postId, address indexed creator, uint256 goalAmount, uint256 minContribution, uint256 deadline);
    event FundsCollected(uint256 indexed postId, address indexed creator, uint256 collectedAmount);
    event RefundIssued(uint256 indexed postId, address indexed contributor, uint256 amount);
    event PostRemoved(uint256 indexed postId);

    modifier onlyActivePost(uint256 _postId) {
        require(posts[_postId].active, "This post is no longer active");
        _;
    }

    modifier onlyCreator(uint256 _postId) {
        require(posts[_postId].creator == msg.sender, "Only the creator can call this function");
        _;
    }

    function createPost(uint256 _goalAmount, uint256 _minContribution) external {
        require(_goalAmount > 0, "Goal amount must be greater than 0");
        require(_minContribution > 0, "Minimum contribution must be greater than 0");

        postCount++;
        Post storage newPost = posts[postCount];
        newPost.creator = payable(msg.sender);
        newPost.goalAmount = _goalAmount;
        newPost.minContribution = _minContribution;
        newPost.deadline = block.timestamp + 5 days;
        newPost.active = true;

        emit PostCreated(postCount, msg.sender, _goalAmount, _minContribution, newPost.deadline);
    }

    function fundPost(uint256 _postId) external payable onlyActivePost(_postId) {
        Post storage post = posts[_postId];
        require(block.timestamp <= post.deadline, "This post has expired");
        require(msg.value >= post.minContribution, "Contribution is less than the minimum required");

        post.collectedAmount += msg.value;
        post.contributions[msg.sender] += msg.value;
        post.contributors.push(msg.sender); // Track contributors

        if (post.collectedAmount >= post.goalAmount) {
            post.creator.transfer(post.collectedAmount);
            emit FundsCollected(_postId, post.creator, post.collectedAmount);
            _removePost(_postId);
        }
    }

    function checkDeadline(uint256 _postId) external onlyActivePost(_postId) {
        Post storage post = posts[_postId];
        require(block.timestamp >= post.deadline, "The post has not reached its deadline yet");

        post.active = false;

        if (post.collectedAmount >= post.goalAmount) {
            post.creator.transfer(post.collectedAmount);
            emit FundsCollected(_postId, post.creator, post.collectedAmount);
        } else {
            _refundAllContributors(_postId);
        }
        _removePost(_postId);
    }

    function _refundAllContributors(uint256 _postId) internal {
        Post storage post = posts[_postId];
        for (uint256 i = 0; i < post.contributors.length; i++) {
            address contributor = post.contributors[i];
            uint256 contribution = post.contributions[contributor];
            if (contribution > 0) {
                post.contributions[contributor] = 0;
                payable(contributor).transfer(contribution);
                emit RefundIssued(_postId, contributor, contribution);
            }
        }
    }

    function claimRefund(uint256 _postId) external onlyActivePost(_postId) {
        Post storage post = posts[_postId];
        require(block.timestamp >= post.deadline, "Cannot claim refund before deadline");
        require(post.collectedAmount < post.goalAmount, "Goal amount reached, no refunds available");

        uint256 contribution = post.contributions[msg.sender];
        require(contribution > 0, "No contributions to refund");

        post.contributions[msg.sender] = 0;
        payable(msg.sender).transfer(contribution);

        emit RefundIssued(_postId, msg.sender, contribution);
    }

    function _removePost(uint256 _postId) internal {
        delete posts[_postId];
        emit PostRemoved(_postId);
    }

    // Function to check the remaining time for a post
    function getRemainingTime(uint256 _postId) external view returns (uint256) {
        Post storage post = posts[_postId];
        if (block.timestamp >= post.deadline) {
            return 0;
        } else {
            return post.deadline - block.timestamp;
        }
    }

    // Function to check the collected funds for a post
    function getCollectedFunds(uint256 _postId) external view returns (uint256) {
        Post storage post = posts[_postId];
        return post.collectedAmount;
    }

    // Function to get details of a post
    function getPost(uint256 _postId) external view returns (address creator, uint256 goalAmount, uint256 deadline, uint256 collectedAmount, uint256 minContribution, bool active) {
        Post storage post = posts[_postId];
        return (post.creator, post.goalAmount, post.deadline, post.collectedAmount, post.minContribution, post.active);
    }

    function getPostIds() external view returns (uint256[] memory) {
    uint256[] memory postIds = new uint256[](postCount);
    for (uint256 i = 1; i <= postCount; i++) {
        if (posts[i].creator != address(0)) {
            postIds[i - 1] = i;
        }
    }
    return postIds;
    }
}
