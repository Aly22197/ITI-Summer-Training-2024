import React, { useEffect, useState } from 'react';
import { BrowserProvider,Contract, parseEther,formatEther} from 'ethers';
import { contractAbi } from './Constant/constant.js';
import { contractAddress } from './Constant/constant.js';

function App() {
    const [provider, setProvider] = useState(null);
    const [signer, setSigner] = useState(null);
    const [contract, setContract] = useState(null);
    const [currentAccount, setCurrentAccount] = useState(null);
    const [postDetails, setPostDetails] = useState({});
    const [postId, setPostId] = useState(0);
    const [fundingAmount, setFundingAmount] = useState("");
    const [goalAmount, setGoalAmount] = useState("");
    const [minContribution, setMinContribution] = useState("");
    const [postIds, setPostIds] = useState([]);

    useEffect(() => {
        const init = async () => {
            if (window.ethereum) {
                const browserProvider = new BrowserProvider(window.ethereum);
                setProvider(browserProvider);

                const signer = await browserProvider.getSigner();
                setSigner(signer);

                const contract = new Contract(contractAddress, contractAbi, signer);
                setContract(contract);

                const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                setCurrentAccount(accounts[0]);

                // Fetch all post IDs
                const ids = await contract.getPostIds();
                setPostIds(ids.map(id => id.toNumber()));
            } else {
                console.log("Please install MetaMask!");
            }
        };

        init();
    }, []);

    const handleCreatePost = async () => {
        if (!signer || !contract) return;

        try {
            const goal = parseEther(goalAmount);
            const minContrib = parseEther(minContribution);
            const transaction = await contract.createPost(goal, minContrib);
            await transaction.wait();
            console.log('Post Created:', transaction);

            // Refresh post IDs after creating a new post
            const ids = await contract.getPostIds();
            setPostIds(ids.map(id => id.toNumber()));
        } catch (error) {
            console.error("Create Post Error:", error);
        }
    };

    const handleFundPost = async () => {
        if (!signer || !contract || postId <= 0) return;

        try {
            const valueInEther = parseEther(fundingAmount);
            const transaction = await contract.fundPost(postId, { value: valueInEther });
            await transaction.wait();
            console.log('Funding Transaction:', transaction);

            // Fetch updated post details
            await fetchPostDetails(postId);
        } catch (error) {
            console.error("Funding Error:", error);
        }
    };

    const handleCheckDeadline = async () => {
        if (!signer || !contract || postId <= 0) return;

        try {
            const transaction = await contract.checkDeadline(postId);
            await transaction.wait();
            console.log('Check Deadline Transaction:', transaction);

            // Fetch updated post details
            await fetchPostDetails(postId);
        } catch (error) {
            console.error("Check Deadline Error:", error);
        }
    };

    const handleClaimRefund = async () => {
        if (!signer || !contract || postId <= 0) return;

        try {
            const transaction = await contract.claimRefund(postId);
            await transaction.wait();
            console.log('Refund Transaction:', transaction);

            // Fetch updated post details
            await fetchPostDetails(postId);
        } catch (error) {
            console.error("Refund Error:", error);
        }
    };

    const fetchPostDetails = async (id) => {
        if (!contract || id <= 0) return;

        try {
            const post = await contract.getPost(id);
            setPostDetails({
                creator: post[0],
                goalAmount: formatEther(post[1]),
                deadline: new Date(post[2] * 1000).toLocaleString(),
                collectedAmount: formatEther(post[3]),
                minContribution: formatEther(post[4]),
                active: post[5],
            });
        } catch (error) {
            console.error("Fetch Post Error:", error);
        }
    };

    const handlePostIdChange = (event) => {
        const id = parseInt(event.target.value);
        setPostId(id);
        fetchPostDetails(id);
    };

    const handleInputChange = (event, setter) => {
        setter(event.target.value);
    };

    return (
        <div>
            <h1>Crowdfunding DApp</h1>
            <p>Connected Account: {currentAccount}</p>

            <h2>Create a New Post</h2>
            <input 
                type="text" 
                value={goalAmount} 
                onChange={(e) => handleInputChange(e, setGoalAmount)} 
                placeholder="Goal Amount in ETH" 
            />
            <input 
                type="text" 
                value={minContribution} 
                onChange={(e) => handleInputChange(e, setMinContribution)} 
                placeholder="Minimum Contribution in ETH" 
            />
            <button onClick={handleCreatePost}>Create Post</button>

            <h2>Fund a Post</h2>
            <select onChange={handlePostIdChange} value={postId}>
                <option value={0}>Select Post ID</option>
                {postIds.map(id => (
                    <option key={id} value={id}>{id}</option>
                ))}
            </select>
            {postDetails.creator && (
                <div>
                    <p><strong>Creator:</strong> {postDetails.creator}</p>
                    <p><strong>Goal Amount:</strong> {postDetails.goalAmount} ETH</p>
                    <p><strong>Deadline:</strong> {postDetails.deadline}</p>
                    <p><strong>Collected Amount:</strong> {postDetails.collectedAmount} ETH</p>
                    <p><strong>Minimum Contribution:</strong> {postDetails.minContribution} ETH</p>
                    <p><strong>Active:</strong> {postDetails.active ? "Yes" : "No"}</p>
                </div>
            )}
            <input 
                type="text" 
                value={fundingAmount} 
                onChange={(e) => handleInputChange(e, setFundingAmount)} 
                placeholder="Enter amount to fund" 
            />
            <button onClick={handleFundPost} disabled={!postDetails.active}>Fund Post</button>
            <button onClick={handleCheckDeadline} disabled={!postDetails.active}>Check Deadline</button>
            <button onClick={handleClaimRefund} disabled={!postDetails.active}>Claim Refund</button>
        </div>
    );
}

export default App;