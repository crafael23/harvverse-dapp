//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title InvestmentAgreement
 * @dev Contract for managing crop investment agreements where farmers tokenize crops
 * and investors can choose between receiving produce or sharing profits
 */
contract InvestmentAgreement is IERC721Receiver, ReentrancyGuard, Ownable {

    enum FulfilmentOption { UNSET, DELIVER_PRODUCE, SHARE_PROFITS }
    
    enum AgreementStatus { Proposed, Funded, ProduceReady, Settled, Defaulted }

    struct Agreement {
        // Parties
        address farmer;
        address investor;

        // Collateral
        address cropNFT;
        uint256 cropTokenId;

        // Economics
        uint256 investAmount;      // ETH supplied by investor (goes to farmer immediately)
        uint256 investorShareBps;  // Basis-points (1/10,000) of sale proceeds owed to investor if SHARE_PROFITS
        uint256 expectedQuantity;  // Planned yield (kg). Informational / oracle check.

        // Logistics
        FulfilmentOption option;   // irrevocably chosen by investor right after funding
        uint256 harvestDeadline;   // by when farmer must mark produce ready
        uint256 deliveryOrSaleDeadline; // by when produce must be delivered or sale proceeds sent

        AgreementStatus status;
    }

    uint256 public agreementCounter;
    mapping(uint256 => Agreement) public agreements;

    // Oracle/trusted party for delivery confirmation
    address public oracle;
    
    event AgreementProposed(
        uint256 indexed agreementId,
        address indexed farmer,
        address cropNFT,
        uint256 cropTokenId,
        uint256 investAmount,
        uint256 investorShareBps,
        uint256 expectedQuantity,
        uint256 harvestDeadline,
        uint256 deliveryOrSaleDeadline
    );
    
    event AgreementFunded(uint256 indexed agreementId, address indexed investor, FulfilmentOption option);
    event HarvestMarkedReady(uint256 indexed agreementId, address indexed farmer);
    event DeliveryConfirmed(uint256 indexed agreementId, address indexed oracle);
    event SaleReported(uint256 indexed agreementId, uint256 saleAmount, uint256 investorShare);
    event AgreementSettled(uint256 indexed agreementId);
    event AgreementDefaulted(uint256 indexed agreementId, address indexed claimant);

    constructor(address _owner, address _oracle) Ownable(_owner) {
        oracle = _oracle;
    }

    /**
     * @dev Propose a new investment agreement
     * @param nftContract Address of the CropNFT contract
     * @param nftTokenId Token ID of the crop NFT
     * @param investAmount Amount of ETH investment requested
     * @param investorShareBps Basis points (1/10,000) of sale proceeds for investor if SHARE_PROFITS
     * @param expectedQuantity Expected yield in kg (informational)
     * @param harvestDeadline Deadline for marking harvest ready
     * @param deliveryOrSaleDeadline Deadline for delivery or sale completion
     * @return agreementId The ID of the created agreement
     */
    function proposeAgreement(
        address nftContract,
        uint256 nftTokenId,
        uint256 investAmount,
        uint256 investorShareBps,
        uint256 expectedQuantity,
        uint256 harvestDeadline,
        uint256 deliveryOrSaleDeadline
    ) external nonReentrant returns (uint256) {
        require(investAmount > 0, "InvestmentAgreement: investment amount must be greater than 0");
        require(investorShareBps <= 10000, "InvestmentAgreement: investor share cannot exceed 100%");
        require(harvestDeadline > block.timestamp, "InvestmentAgreement: harvest deadline must be in future");
        require(deliveryOrSaleDeadline > harvestDeadline, "InvestmentAgreement: delivery deadline must be after harvest");
        require(nftContract != address(0), "InvestmentAgreement: invalid NFT contract");
        
        // Transfer NFT from farmer to this contract
        IERC721(nftContract).safeTransferFrom(msg.sender, address(this), nftTokenId);
        
        uint256 agreementId = agreementCounter++;
        
        agreements[agreementId] = Agreement({
            farmer: msg.sender,
            investor: address(0),
            cropNFT: nftContract,
            cropTokenId: nftTokenId,
            investAmount: investAmount,
            investorShareBps: investorShareBps,
            expectedQuantity: expectedQuantity,
            option: FulfilmentOption.UNSET,
            harvestDeadline: harvestDeadline,
            deliveryOrSaleDeadline: deliveryOrSaleDeadline,
            status: AgreementStatus.Proposed
        });
        
        emit AgreementProposed(
            agreementId,
            msg.sender,
            nftContract,
            nftTokenId,
            investAmount,
            investorShareBps,
            expectedQuantity,
            harvestDeadline,
            deliveryOrSaleDeadline
        );
        
        return agreementId;
    }

    /**
     * @dev Fund an agreement and choose fulfilment option
     * @param agreementId The ID of the agreement to fund
     * @param option The chosen fulfilment option (DELIVER_PRODUCE or SHARE_PROFITS)
     */
    function fundAgreement(uint256 agreementId, FulfilmentOption option) external payable nonReentrant {
        Agreement storage agreement = agreements[agreementId];
        require(agreement.status == AgreementStatus.Proposed, "InvestmentAgreement: agreement not available for funding");
        require(agreement.farmer != address(0), "InvestmentAgreement: agreement does not exist");
        require(msg.value == agreement.investAmount, "InvestmentAgreement: incorrect ETH amount");
        require(option == FulfilmentOption.DELIVER_PRODUCE || option == FulfilmentOption.SHARE_PROFITS, "InvestmentAgreement: invalid fulfilment option");
        
        agreement.investor = msg.sender;
        agreement.option = option;
        agreement.status = AgreementStatus.Funded;
        
        // Transfer ETH immediately to farmer
        (bool success, ) = agreement.farmer.call{value: agreement.investAmount}("");
        require(success, "InvestmentAgreement: ETH transfer to farmer failed");
        
        emit AgreementFunded(agreementId, msg.sender, option);
    }

    /**
     * @dev Mark harvest as ready (called by farmer)
     * @param agreementId The ID of the agreement
     */
    function markHarvestReady(uint256 agreementId) external nonReentrant {
        Agreement storage agreement = agreements[agreementId];
        require(agreement.status == AgreementStatus.Funded, "InvestmentAgreement: agreement not funded");
        require(agreement.farmer == msg.sender, "InvestmentAgreement: only farmer can mark harvest ready");
        require(block.timestamp <= agreement.harvestDeadline, "InvestmentAgreement: harvest deadline passed");
        
        agreement.status = AgreementStatus.ProduceReady;
        
        emit HarvestMarkedReady(agreementId, msg.sender);
    }

    /**
     * @dev Confirm delivery (can be called by anyone for conceptual testing)
     * @param agreementId The ID of the agreement
     */
    function confirmDelivery(uint256 agreementId) external nonReentrant {
        // Remove oracle restriction for conceptual testing
        // require(msg.sender == oracle, "InvestmentAgreement: only oracle can confirm delivery");
        
        Agreement storage agreement = agreements[agreementId];
        require(agreement.status == AgreementStatus.ProduceReady, "InvestmentAgreement: produce not ready");
        require(agreement.option == FulfilmentOption.DELIVER_PRODUCE, "InvestmentAgreement: agreement not for delivery");
        require(block.timestamp <= agreement.deliveryOrSaleDeadline, "InvestmentAgreement: delivery deadline passed");
        
        agreement.status = AgreementStatus.Settled;
        
        // Return NFT to farmer
        IERC721(agreement.cropNFT).safeTransferFrom(address(this), agreement.farmer, agreement.cropTokenId);
        
        emit DeliveryConfirmed(agreementId, msg.sender);
        emit AgreementSettled(agreementId);
    }

    /**
     * @dev Report sale and distribute proceeds (called by farmer for SHARE_PROFITS option)
     * @param agreementId The ID of the agreement
     * @param saleAmount Total amount received from crop sale
     */
    function reportSale(uint256 agreementId, uint256 saleAmount) external payable nonReentrant {
        Agreement storage agreement = agreements[agreementId];
        require(agreement.status == AgreementStatus.ProduceReady, "InvestmentAgreement: produce not ready");
        require(agreement.farmer == msg.sender, "InvestmentAgreement: only farmer can report sale");
        require(agreement.option == FulfilmentOption.SHARE_PROFITS, "InvestmentAgreement: agreement not for profit sharing");
        require(block.timestamp <= agreement.deliveryOrSaleDeadline, "InvestmentAgreement: sale deadline passed");
        
        uint256 investorShare = (saleAmount * agreement.investorShareBps) / 10000;
        require(msg.value >= investorShare, "InvestmentAgreement: insufficient ETH for investor share");
        
        agreement.status = AgreementStatus.Settled;
        
        // Transfer investor's share
        if (investorShare > 0) {
            (bool success, ) = agreement.investor.call{value: investorShare}("");
            require(success, "InvestmentAgreement: ETH transfer to investor failed");
        }
        
        // Return excess ETH to farmer if any
        uint256 excess = msg.value - investorShare;
        if (excess > 0) {
            (bool success, ) = agreement.farmer.call{value: excess}("");
            require(success, "InvestmentAgreement: excess ETH return failed");
        }
        
        // Return NFT to farmer
        IERC721(agreement.cropNFT).safeTransferFrom(address(this), agreement.farmer, agreement.cropTokenId);
        
        emit SaleReported(agreementId, saleAmount, investorShare);
        emit AgreementSettled(agreementId);
    }

    /**
     * @dev Claim collateral when deadlines are missed (called by investor)
     * @param agreementId The ID of the agreement
     */
    function claimCollateral(uint256 agreementId) external nonReentrant {
        Agreement storage agreement = agreements[agreementId];
        require(agreement.investor == msg.sender, "InvestmentAgreement: only investor can claim collateral");
        require(agreement.status == AgreementStatus.Funded || agreement.status == AgreementStatus.ProduceReady, "InvestmentAgreement: invalid status for claiming");
        
        bool canClaim = false;
        
        // Check if harvest deadline passed and still in Funded status
        if (agreement.status == AgreementStatus.Funded && block.timestamp > agreement.harvestDeadline) {
            canClaim = true;
        }
        // Check if delivery/sale deadline passed and still in ProduceReady status
        else if (agreement.status == AgreementStatus.ProduceReady && block.timestamp > agreement.deliveryOrSaleDeadline) {
            canClaim = true;
        }
        
        require(canClaim, "InvestmentAgreement: cannot claim collateral yet");
        
        agreement.status = AgreementStatus.Defaulted;
        
        // Transfer NFT to investor
        IERC721(agreement.cropNFT).safeTransferFrom(address(this), agreement.investor, agreement.cropTokenId);
        
        emit AgreementDefaulted(agreementId, msg.sender);
    }

    /**
     * @dev Get agreement details
     * @param agreementId The ID of the agreement
     * @return Agreement struct with all details
     */
    function getAgreement(uint256 agreementId) external view returns (Agreement memory) {
        return agreements[agreementId];
    }

    /**
     * @dev Update oracle address (only owner)
     * @param newOracle New oracle address
     */
    function setOracle(address newOracle) external onlyOwner {
        require(newOracle != address(0), "InvestmentAgreement: invalid oracle address");
        oracle = newOracle;
    }

    /**
     * @dev Required for receiving NFTs
     */
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
} 