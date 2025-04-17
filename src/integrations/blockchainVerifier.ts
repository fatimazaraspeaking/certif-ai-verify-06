
import { nanoid } from 'nanoid';
import { MistralVerificationResponse } from '../types';

/**
 * Blockchain Certificate Verifier Module
 * 
 * This module extends verification by adding blockchain verification capabilities.
 * It can verify certificates stored on blockchains like Ethereum, Solana, and Arweave.
 */

interface BlockchainVerificationResult {
  isVerified: boolean;
  chainName: string;
  transactionId?: string;
  mintAddress?: string;
  verificationTime?: string;
  error?: string;
}

/**
 * Verify a certificate on the Solana blockchain
 */
export async function verifySolanaCertificate(
  nftMintAddress: string
): Promise<BlockchainVerificationResult> {
  try {
    // In a real implementation, this would make RPC calls to Solana
    // to verify the NFT exists and check its metadata
    
    // For demo purposes, we'll simulate a verification
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const isValidAddress = /^[A-Za-z0-9]{32,44}$/.test(nftMintAddress);
    
    if (!isValidAddress) {
      return {
        isVerified: false,
        chainName: 'solana',
        error: 'Invalid Solana NFT mint address format'
      };
    }
    
    // Simulate success for this demo
    return {
      isVerified: true,
      chainName: 'solana',
      mintAddress: nftMintAddress,
      transactionId: `${nanoid(8)}...${nanoid(8)}`,
      verificationTime: new Date().toISOString()
    };
  } catch (error) {
    console.error('Solana verification error:', error);
    return {
      isVerified: false,
      chainName: 'solana',
      error: `Solana verification failed: ${error.message}`
    };
  }
}

/**
 * Verify a certificate on Arweave permanent storage
 */
export async function verifyArweaveCertificate(
  arweaveUrl: string
): Promise<BlockchainVerificationResult> {
  try {
    // Extract transaction ID from Arweave URL
    const txId = arweaveUrl.split('/').pop() || '';
    
    if (!/^[a-zA-Z0-9_-]{43}$/.test(txId)) {
      return {
        isVerified: false,
        chainName: 'arweave',
        error: 'Invalid Arweave transaction ID format'
      };
    }
    
    // In a real implementation, this would query the Arweave network
    // to verify the transaction exists and check its data
    
    // For demo purposes, we'll simulate a verification
    await new Promise(resolve => setTimeout(resolve, 300));
    
    return {
      isVerified: true,
      chainName: 'arweave',
      transactionId: txId,
      verificationTime: new Date().toISOString()
    };
  } catch (error) {
    console.error('Arweave verification error:', error);
    return {
      isVerified: false,
      chainName: 'arweave',
      error: `Arweave verification failed: ${error.message}`
    };
  }
}

/**
 * Combine AI verification with blockchain verification
 */
export async function enhanceVerificationWithBlockchain(
  aiResult: MistralVerificationResponse,
  nftMintAddress?: string,
  arweaveUrl?: string
): Promise<{
  aiVerification: MistralVerificationResponse;
  blockchainVerification: BlockchainVerificationResult[];
  combinedVerified: boolean;
}> {
  const blockchainResults: BlockchainVerificationResult[] = [];
  
  // Check if we have blockchain data to verify
  if (nftMintAddress) {
    const solanaResult = await verifySolanaCertificate(nftMintAddress);
    blockchainResults.push(solanaResult);
  }
  
  if (arweaveUrl) {
    const arweaveResult = await verifyArweaveCertificate(arweaveUrl);
    blockchainResults.push(arweaveResult);
  }
  
  // Determine combined verification status
  const aiVerified = aiResult.total_verification === 'pass';
  const blockchainVerified = blockchainResults.length > 0 && 
                             blockchainResults.every(result => result.isVerified);
  
  // We require both AI and at least one blockchain verification if blockchain data is provided
  const combinedVerified = aiVerified && 
                          (blockchainResults.length === 0 || blockchainVerified);
  
  return {
    aiVerification: aiResult,
    blockchainVerification: blockchainResults,
    combinedVerified
  };
}
