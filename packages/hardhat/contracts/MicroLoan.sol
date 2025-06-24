//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title MicroLoan
 * @dev Contract for managing NFT-collateralized microloans using ETH
 */
contract MicroLoan is IERC721Receiver, ReentrancyGuard {

    enum LoanStatus {
        Requested,
        Funded,
        Repaid,
        Liquidated
    }

    struct Loan {
        address borrower;
        address lender;
        address nftContract;
        uint256 nftTokenId;
        uint256 principal;
        uint256 interest;
        uint256 deadline;
        LoanStatus status;
    }

    uint256 public loanCounter;
    uint256 public constant INTEREST_RATE = 5; // 5% fixed interest
    uint256 public constant LOAN_DURATION = 90 days; // 90 days loan period

    mapping(uint256 => Loan) public loans;

    event LoanRequested(
        uint256 indexed loanId,
        address indexed borrower,
        address nftContract,
        uint256 nftTokenId,
        uint256 amount
    );
    event LoanFunded(uint256 indexed loanId, address indexed lender);
    event LoanRepaid(uint256 indexed loanId, address indexed borrower);
    event LoanLiquidated(uint256 indexed loanId, address indexed lender);

    /**
     * @dev Request a loan using an NFT as collateral
     * @param nftContract Address of the NFT contract
     * @param nftTokenId Token ID of the NFT
     * @param amount Loan amount requested in ETH (wei)
     * @return loanId The ID of the created loan
     */
    function requestLoan(
        address nftContract,
        uint256 nftTokenId,
        uint256 amount
    ) external nonReentrant returns (uint256) {
        require(amount > 0, "MicroLoan: amount must be greater than 0");
        require(nftContract != address(0), "MicroLoan: invalid NFT contract");
        
        // Transfer NFT from borrower to this contract
        IERC721(nftContract).safeTransferFrom(msg.sender, address(this), nftTokenId);
        
        uint256 loanId = loanCounter++;
        uint256 interest = (amount * INTEREST_RATE) / 100;
        
        loans[loanId] = Loan({
            borrower: msg.sender,
            lender: address(0),
            nftContract: nftContract,
            nftTokenId: nftTokenId,
            principal: amount,
            interest: interest,
            deadline: 0, // Set when funded
            status: LoanStatus.Requested
        });
        
        emit LoanRequested(loanId, msg.sender, nftContract, nftTokenId, amount);
        
        return loanId;
    }

    /**
     * @dev Fund a loan request with ETH
     * @param loanId The ID of the loan to fund
     */
    function fundLoan(uint256 loanId) external payable nonReentrant {
        Loan storage loan = loans[loanId];
        require(loan.status == LoanStatus.Requested, "MicroLoan: loan not available for funding");
        require(loan.borrower != address(0), "MicroLoan: loan does not exist");
        require(msg.value == loan.principal, "MicroLoan: incorrect ETH amount");
        
        loan.lender = msg.sender;
        loan.deadline = block.timestamp + LOAN_DURATION;
        loan.status = LoanStatus.Funded;
        
        // Transfer ETH from lender to borrower
        (bool success, ) = loan.borrower.call{value: loan.principal}("");
        require(success, "MicroLoan: ETH transfer failed");
        
        emit LoanFunded(loanId, msg.sender);
    }

    /**
     * @dev Repay a loan with ETH and retrieve the NFT
     * @param loanId The ID of the loan to repay
     */
    function repay(uint256 loanId) external payable nonReentrant {
        Loan storage loan = loans[loanId];
        require(loan.status == LoanStatus.Funded, "MicroLoan: loan not funded");
        require(loan.borrower == msg.sender, "MicroLoan: only borrower can repay");
        require(block.timestamp <= loan.deadline, "MicroLoan: loan expired");
        
        uint256 totalRepayment = loan.principal + loan.interest;
        require(msg.value == totalRepayment, "MicroLoan: incorrect repayment amount");
        
        loan.status = LoanStatus.Repaid;
        
        // Transfer repayment ETH from borrower to lender
        (bool success, ) = loan.lender.call{value: totalRepayment}("");
        require(success, "MicroLoan: ETH transfer failed");
        
        // Return NFT to borrower
        IERC721(loan.nftContract).safeTransferFrom(address(this), loan.borrower, loan.nftTokenId);
        
        emit LoanRepaid(loanId, msg.sender);
    }

    /**
     * @dev Liquidate an expired loan
     * @param loanId The ID of the loan to liquidate
     */
    function liquidate(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        require(loan.status == LoanStatus.Funded, "MicroLoan: loan not funded");
        require(block.timestamp > loan.deadline, "MicroLoan: loan not expired");
        require(loan.lender == msg.sender, "MicroLoan: only lender can liquidate");
        
        loan.status = LoanStatus.Liquidated;
        
        // Transfer NFT to lender
        IERC721(loan.nftContract).safeTransferFrom(address(this), loan.lender, loan.nftTokenId);
        
        emit LoanLiquidated(loanId, msg.sender);
    }

    /**
     * @dev Get loan details
     * @param loanId The ID of the loan
     * @return Loan struct with all details
     */
    function getLoan(uint256 loanId) external view returns (Loan memory) {
        return loans[loanId];
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