import React, { useState, useEffect } from 'react';
import styles from '../styles/Money.module.css';
import { POOLS, TOKENS, TOKEN_DECIMALS } from '../utils/trading-routes';
// Import the needed SDK functions with correct names
import { init_env, getPool } from '@ref-finance/ref-sdk';
import { Pool } from '@ref-finance/ref-sdk/dist/types';
import { JsonRpcProvider } from 'near-api-js/lib/providers';
import { Big } from 'big.js';
import { CransPrice } from './CransPrice';

// Add USDC token and pool definition
const USDC = '17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1';
const NEAR_USDC_POOL = 4512;

// Helper function to calculate token price in USDC
const calculateTokenPriceInUSDC = async (
  tokenAmount: string,
  tokenDecimals: number,
  nearPrice: Big
): Promise<Big> => {
  try {
    // Convert token amount to decimal representation
    const amount = new Big(tokenAmount).div(new Big(10).pow(tokenDecimals));
    // Multiply by NEAR price to get USDC value
    return amount.mul(nearPrice);
  } catch (error) {
    console.error('Error calculating token price:', error);
    return new Big(0);
  }
};

// Function to get NEAR price in USDC
const getNearPriceInUSDC = async (): Promise<Big> => {
  try {
    const provider = new JsonRpcProvider({ url: 'https://free.rpc.fastnear.com' });
    const args = {
      pool_id: NEAR_USDC_POOL,
      token_in: TOKENS.NEAR,
      token_out: USDC,
      amount_in: '1000000000000000000000000' // 1 NEAR (24 decimals)
    };
    const args_base64 = Buffer.from(JSON.stringify(args)).toString('base64');
    
    const response: any = await provider.query({
      request_type: 'call_function',
      account_id: 'v2.ref-finance.near',
      method_name: 'get_return',
      args_base64,
      finality: 'final'
    });
    
    if (response && response.result) {
      const resultBytes = Buffer.from(response.result);
      const resultText = new TextDecoder().decode(resultBytes);
      const usdcAmount = JSON.parse(resultText);
      
      // Convert USDC amount from 6 decimals to decimal representation
      return new Big(usdcAmount).div(new Big(10).pow(6));
    }
    
    return new Big(0);
  } catch (error) {
    console.error('Error getting NEAR price:', error);
    return new Big(0);
  }
};

interface SimplePairInfo {
  pair: string;
  token1: string;
  token2: string;
  token1Symbol: string;
  token2Symbol: string;
  token1Amount: string;
  token2Amount: string;
  lpShares: string;
  sharesPercent: string;
  usdValue: string;
  inLocked?: boolean;
}

// Add local token icons mapping
const LOCAL_TOKEN_ICONS: Record<string, string> = {
  'wrap.near': '/icons/near.png'
};

interface TokenMetadata {
  decimals: number;
  icon?: string;
  name: string;
  symbol: string;
}

// Add function to get token metadata
const getTokenMetadata = async (tokenId: string): Promise<TokenMetadata | null> => {
  try {
    const provider = new JsonRpcProvider({ url: 'https://free.rpc.fastnear.com' });
    const response: any = await provider.query({
      request_type: 'call_function',
      finality: 'final',
      account_id: tokenId,
      method_name: 'ft_metadata',
      args_base64: ''
    });
    
    if (response && response.result) {
      const resultBytes = Buffer.from(response.result);
      const resultText = new TextDecoder().decode(resultBytes);
      return JSON.parse(resultText);
    }
    
    return null;
  } catch (error) {
    console.error(`Error getting metadata for token ${tokenId}:`, error);
    return null;
  }
};

// Add function to get CRANS total supply
const getCransTotalSupply = async (): Promise<string> => {
  try {
    const provider = new JsonRpcProvider({ url: 'https://free.rpc.fastnear.com' });
    const response: any = await provider.query({
      request_type: 'call_function',
      finality: 'final',
      account_id: 'crans.tkn.near',
      method_name: 'ft_total_supply',
      args_base64: ''
    });
    
    if (response && response.result) {
      const resultBytes = Buffer.from(response.result);
      const resultText = new TextDecoder().decode(resultBytes);
      const totalSupply = JSON.parse(resultText);
      return totalSupply;
    }
    
    return '0';
  } catch (error) {
    console.error('Error getting CRANS total supply:', error);
    return '0';
  }
};

// Custom implementation to get pool shares using near-api-js
const getPoolShare = async (poolId: number, accountId: string): Promise<string> => {
  try {
    const provider = new JsonRpcProvider({ url: 'https://free.rpc.fastnear.com' });
    const args = { account_id: accountId, pool_id: poolId };
    const args_base64 = Buffer.from(JSON.stringify(args)).toString('base64');
    
    const response: any = await provider.query({
      request_type: 'call_function',
      account_id: 'v2.ref-finance.near',
      method_name: 'get_pool_shares',
      args_base64,
      finality: 'final'
    });
    
    if (response && response.result) {
      const resultBytes = Buffer.from(response.result);
      const resultText = new TextDecoder().decode(resultBytes);
      const shares = JSON.parse(resultText);
      return shares || '0';
    }
    
    return '0';
  } catch (error) {
    console.error(`Error in getPoolShare for pool ${poolId}:`, error);
    return '0';
  }
};

// Custom implementation to get all pools
const getRefPools = async (): Promise<Pool[]> => {
  try {
    const provider = new JsonRpcProvider({ url: 'https://free.rpc.fastnear.com' });
    const args = { from_index: 0, limit: 300 };
    const args_base64 = Buffer.from(JSON.stringify(args)).toString('base64');
    
    const response: any = await provider.query({
      request_type: 'call_function',
      account_id: 'v2.ref-finance.near',
      method_name: 'get_pools',
      args_base64,
      finality: 'final'
    });
    
    if (response && response.result) {
      const resultBytes = Buffer.from(response.result);
      const resultText = new TextDecoder().decode(resultBytes);
      const pools = JSON.parse(resultText);
      return pools;
    }
    
    return [];
  } catch (error) {
    console.error('Error in getRefPools:', error);
    return [];
  }
};

const getPoolData = async (poolId: number) => {
  try {
    const provider = new JsonRpcProvider({ url: 'https://free.rpc.fastnear.com' });
    const args = { pool_id: poolId };
    const args_base64 = Buffer.from(JSON.stringify(args)).toString('base64');
    
    const response: any = await provider.query({
      request_type: 'call_function',
      account_id: 'v2.ref-finance.near',
      method_name: 'get_pool',
      args_base64,
      finality: 'final'
    });
    
    if (response && response.result) {
      const resultBytes = Buffer.from(response.result);
      const resultText = new TextDecoder().decode(resultBytes);
      const poolData = JSON.parse(resultText);
      return poolData;
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching pool ${poolId}:`, error);
    return null;
  }
};

const getPoolTokenAmount = (
  amounts: string[],
  tokenAccountIds: string[],
  tokenId: string
): string => {
  const index = tokenAccountIds.indexOf(tokenId);
  return index >= 0 ? amounts[index] : '0';
};

// Utility function to format token amounts
const formatTokenAmount = (amount: string, tokenId: string): string => {
  const decimals = TOKEN_DECIMALS[tokenId] || 24; // Default to 24 if not found
  const amountBN = BigInt(amount);
  const divisor = BigInt(10) ** BigInt(decimals);
  const value = Number(amountBN) / Number(divisor);
  
  // Format with k, M, B notation
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`;
  } else if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  } else if (value >= 1_000) {
    return `${(value / 1_000).toFixed(2)}k`;
  } else {
    return value.toFixed(2);
  }
};

// Add getReturn function before fetchPairsData
const getReturn = async (args: {
  pool_id: number;
  token_in: string;
  token_out: string;
  amount_in: string;
}): Promise<string | null> => {
  try {
    const provider = new JsonRpcProvider({ url: 'https://free.rpc.fastnear.com' });
    const args_base64 = Buffer.from(JSON.stringify(args)).toString('base64');
    
    const response: any = await provider.query({
      request_type: 'call_function',
      account_id: 'v2.ref-finance.near',
      method_name: 'get_return',
      args_base64,
      finality: 'final'
    });
    
    if (response && response.result) {
      const resultBytes = Buffer.from(response.result);
      const resultText = new TextDecoder().decode(resultBytes);
      return JSON.parse(resultText);
    }
    
    return null;
  } catch (error) {
    console.error('Error in getReturn:', error);
    return null;
  }
};

// Add new helper function for getting token price in NEAR
const getTokenPriceInNear = async (poolId: number, tokenId: string): Promise<Big> => {
  try {
    // Get how many tokens we get for 1 NEAR
    const args = {
      pool_id: poolId,
      token_in: TOKENS.NEAR,
      token_out: tokenId,
      amount_in: '1000000000000000000000000' // 1 NEAR (24 decimals)
    };
    
    const tokensForOneNear = await getReturn(args);
    if (!tokensForOneNear) return new Big(0);
    
    // Calculate price: 1 / (tokens per NEAR)
    const tokenDecimals = TOKEN_DECIMALS[tokenId] || 24;
    const tokensPerNear = new Big(tokensForOneNear).div(new Big(10).pow(tokenDecimals));
    return new Big(1).div(tokensPerNear);
  } catch (error) {
    console.error('Error getting token price in NEAR:', error);
    return new Big(0);
  }
};

export function Money() {
  const [pairs, setPairs] = useState<SimplePairInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rawPoolData, setRawPoolData] = useState<any[]>([]);
  const [totalTVL, setTotalTVL] = useState<string>('0');
  const [cransTotalSupply, setCransTotalSupply] = useState<string>('0');
  const [tokenMetadata, setTokenMetadata] = useState<Record<string, TokenMetadata>>({});

  useEffect(() => {
    const fetchPairsData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Get NEAR price in USDC first
        const nearPrice = await getNearPriceInUSDC();
        console.log('Current NEAR price in USDC:', nearPrice.toString());

        // Define the specific CRANS pairs we want to display
        const targetPools = [
          { id: POOLS.CRANS_NEAR, name: 'CRANS/NEAR', token1: TOKENS.CRANS, token2: TOKENS.NEAR },
          { id: POOLS.CRANS_SIN, name: 'CRANS/SIN', token1: TOKENS.CRANS, token2: TOKENS.SIN },
          { id: POOLS.CRANS_PUMP, name: 'CRANS/PUMPOPOLY', token1: TOKENS.CRANS, token2: TOKENS.PUMP },
          { id: POOLS.CRANS_BD, name: 'CRANS/BLACKDRAGON', token1: TOKENS.CRANS, token2: TOKENS.BD },
          { id: POOLS.CRANS_SHITZU, name: 'CRANS/SHITZU', token1: TOKENS.CRANS, token2: TOKENS.SHITZU },
          { id: POOLS.CRANS_1170, name: 'CRANS/SHIT', token1: TOKENS.CRANS, token2: TOKENS.MEME1170 },
        ];

        // Fetch pool data first to get token addresses
        const poolDataResults = await Promise.all(
          targetPools.map(async (pool) => {
            const data = await getPoolData(pool.id);
            return { pool, data };
          })
        );

        // Extract unique token addresses from pool data, excluding wrap.near
        const tokenAddresses = new Set<string>();
        poolDataResults.forEach(({ data }) => {
          if (data && data.token_account_ids) {
            data.token_account_ids.forEach((address: string) => {
              if (address !== 'wrap.near') {
                tokenAddresses.add(address);
              }
            });
          }
        });

        // Fetch metadata for all token addresses except wrap.near
        const metadataResults = await Promise.all(
          Array.from(tokenAddresses).map(async (tokenId) => {
            const metadata = await getTokenMetadata(tokenId);
            return { tokenId, metadata };
          })
        );
        
        const metadataMap: Record<string, TokenMetadata> = {};
        // Add local icons first
        Object.entries(LOCAL_TOKEN_ICONS).forEach(([tokenId, iconPath]) => {
          metadataMap[tokenId] = {
            decimals: 24, // NEAR has 24 decimals
            icon: iconPath,
            name: tokenId === 'wrap.near' ? 'NEAR' : tokenId,
            symbol: tokenId === 'wrap.near' ? 'NEAR' : tokenId
          };
        });
        // Add fetched metadata
        metadataResults.forEach(({ tokenId, metadata }) => {
          if (metadata) {
            metadataMap[tokenId] = metadata;
          }
        });
        setTokenMetadata(metadataMap);

        // Fetch CRANS total supply
        const totalSupply = await getCransTotalSupply();
        const formattedTotalSupply = formatTokenAmount(totalSupply, TOKENS.CRANS);
        setCransTotalSupply(formattedTotalSupply);

        // Calculate prices for all tokens in USDC
        const tokenPricesUSD = new Map<string, Big>();

        // Add NEAR price to USD prices map
        tokenPricesUSD.set(TOKENS.NEAR, nearPrice);
        
        // Get CRANS price in NEAR from CRANS/NEAR pool
        const cransForOneNear = await getReturn({
          pool_id: POOLS.CRANS_NEAR,
          token_in: TOKENS.NEAR,
          token_out: TOKENS.CRANS,
          amount_in: '1000000000000000000000000' // 1 NEAR
        });
        
        if (cransForOneNear) {
          const cransPerNear = new Big(cransForOneNear).div(new Big(10).pow(TOKEN_DECIMALS[TOKENS.CRANS]));
          const cransPriceInUSD = nearPrice.div(cransPerNear);
          tokenPricesUSD.set(TOKENS.CRANS, cransPriceInUSD);
          console.log('CRANS per NEAR:', cransPerNear.toString());
          console.log('CRANS price in USD:', cransPriceInUSD.toString());
        }

        // Get SIN price in NEAR from SIN/NEAR pool
        const sinForOneNear = await getReturn({
          pool_id: POOLS.SIN_NEAR,
          token_in: TOKENS.NEAR,
          token_out: TOKENS.SIN,
          amount_in: '1000000000000000000000000' // 1 NEAR
        });
        
        if (sinForOneNear) {
          const sinPerNear = new Big(sinForOneNear).div(new Big(10).pow(TOKEN_DECIMALS[TOKENS.SIN]));
          const sinPriceInUSD = nearPrice.div(sinPerNear);
          tokenPricesUSD.set(TOKENS.SIN, sinPriceInUSD);
          console.log('SIN per NEAR:', sinPerNear.toString());
          console.log('SIN price in USD:', sinPriceInUSD.toString());
        }

        // Get PUMP price in NEAR from PUMP/NEAR pool
        const pumpForOneNear = await getReturn({
          pool_id: POOLS.PUMP_NEAR,
          token_in: TOKENS.NEAR,
          token_out: TOKENS.PUMP,
          amount_in: '1000000000000000000000000' // 1 NEAR
        });
        
        if (pumpForOneNear) {
          const pumpPerNear = new Big(pumpForOneNear).div(new Big(10).pow(TOKEN_DECIMALS[TOKENS.PUMP]));
          const pumpPriceInUSD = nearPrice.div(pumpPerNear);
          tokenPricesUSD.set(TOKENS.PUMP, pumpPriceInUSD);
          console.log('PUMP per NEAR:', pumpPerNear.toString());
          console.log('PUMP price in USD:', pumpPriceInUSD.toString());
        }

        // Get BD price using CRANS/BD pool first
        const cransForOneBd = await getReturn({
          pool_id: POOLS.CRANS_BD,
          token_in: TOKENS.BD,
          token_out: TOKENS.CRANS,
          amount_in: '1000000000000000000000000' // 1 BD
        });

        // Debug log for BD/NEAR pool data
        const bdNearPoolData = await getPoolData(POOLS.BD_NEAR);
        console.log('BD/NEAR Pool Data:', bdNearPoolData);

        // Debug log for CRANS/BD pool data
        const cransBdPoolData = await getPoolData(POOLS.CRANS_BD);
        console.log('CRANS/BD Pool Data:', cransBdPoolData);
        
        if (cransForOneBd) {
          const cransPerBd = new Big(cransForOneBd).div(new Big(10).pow(TOKEN_DECIMALS[TOKENS.CRANS]));
          // Since we already have CRANS price in USD, we can calculate BD price
          const cransPriceUSD = tokenPricesUSD.get(TOKENS.CRANS);
          if (cransPriceUSD) {
            const bdPriceInUSD = cransPriceUSD.mul(cransPerBd);
            tokenPricesUSD.set(TOKENS.BD, bdPriceInUSD);
            console.log('CRANS per BD:', cransPerBd.toString());
            console.log('BD price in USD:', bdPriceInUSD.toString());
          }
        }

        // Fallback to BD/NEAR pool if CRANS/BD calculation fails
        if (!tokenPricesUSD.has(TOKENS.BD)) {
          const bdForOneNear = await getReturn({
            pool_id: POOLS.BD_NEAR,
            token_in: TOKENS.NEAR,
            token_out: TOKENS.BD,
            amount_in: '1000000000000000000000000' // 1 NEAR
          });
          
          if (bdForOneNear) {
            const bdPerNear = new Big(bdForOneNear).div(new Big(10).pow(TOKEN_DECIMALS[TOKENS.BD]));
            const bdPriceInUSD = nearPrice.div(bdPerNear);
            tokenPricesUSD.set(TOKENS.BD, bdPriceInUSD);
            console.log('BD per NEAR:', bdPerNear.toString());
            console.log('BD price in USD:', bdPriceInUSD.toString());
          }
        }

        // Get SHITZU price in NEAR from SHITZU/NEAR pool
        const shitzuForOneNear = await getReturn({
          pool_id: POOLS.SHITZU_NEAR,
          token_in: TOKENS.NEAR,
          token_out: TOKENS.SHITZU,
          amount_in: '1000000000000000000000000' // 1 NEAR
        });
        
        if (shitzuForOneNear) {
          const shitzuPerNear = new Big(shitzuForOneNear).div(new Big(10).pow(TOKEN_DECIMALS[TOKENS.SHITZU]));
          const shitzuPriceInUSD = nearPrice.div(shitzuPerNear);
          tokenPricesUSD.set(TOKENS.SHITZU, shitzuPriceInUSD);
          console.log('SHITZU per NEAR:', shitzuPerNear.toString());
          console.log('SHITZU price in USD:', shitzuPriceInUSD.toString());
        }

        // Get SHIT price in NEAR from SHIT/NEAR pool
        const shitForOneNear = await getReturn({
          pool_id: POOLS.SHIT_NEAR,
          token_in: TOKENS.NEAR,
          token_out: TOKENS.MEME1170,
          amount_in: '1000000000000000000000000' // 1 NEAR
        });
        
        if (shitForOneNear) {
          const shitPerNear = new Big(shitForOneNear).div(new Big(10).pow(TOKEN_DECIMALS[TOKENS.MEME1170]));
          const shitPriceInUSD = nearPrice.div(shitPerNear);
          tokenPricesUSD.set(TOKENS.MEME1170, shitPriceInUSD);
          console.log('SHIT per NEAR:', shitPerNear.toString());
          console.log('SHIT price in USD:', shitPriceInUSD.toString());
        }

        // Process pool data with metadata
        const processedPoolData = poolDataResults
          .map(({ pool, data }) => {
            if (!data) return null;

            // Get token amounts
            const [amount1, amount2] = data.amounts || ['0', '0'];
            const [token1, token2] = data.token_account_ids || [];

            // Calculate total USD value using pre-calculated prices
            let totalUsdValue = new Big(0);

            // Calculate value for both tokens using their USD prices
            const token1Amount = new Big(amount1).div(new Big(10).pow(TOKEN_DECIMALS[token1]));
            const token2Amount = new Big(amount2).div(new Big(10).pow(TOKEN_DECIMALS[token2]));

            const token1PriceUSD = tokenPricesUSD.get(token1);
            const token2PriceUSD = tokenPricesUSD.get(token2);

            if (token1PriceUSD) {
              totalUsdValue = totalUsdValue.add(token1Amount.mul(token1PriceUSD));
            }
            if (token2PriceUSD) {
              totalUsdValue = totalUsdValue.add(token2Amount.mul(token2PriceUSD));
            }

            return {
              ...pool,
              poolData: data,
              usdValue: totalUsdValue.toFixed(2)
            };
          })
          .filter(Boolean);

        setRawPoolData(processedPoolData);

        // Calculate total TVL
        const tvl = processedPoolData.reduce((acc, pool) => {
          return acc + parseFloat((pool as any).usdValue);
        }, 0);
        setTotalTVL(tvl.toFixed(2));

        // Log data for inspection
        console.log('Raw pool data with USD values:', processedPoolData);
        console.log('Total TVL:', tvl.toFixed(2));
        console.log('Token metadata:', metadataMap);

      } catch (error: any) {
        console.error('Failed to fetch pairs data:', error);
        setError(error.message || 'Failed to fetch data');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchPairsData();
  }, []);

  // Update the debug display for raw pool data
  if (rawPoolData.length > 0) {
    return (
      <div className={styles.pairsContainer}>
        <div className={styles.statsContainer}>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Total TVL</div>
            <div className={styles.statValue}>${totalTVL}</div>
          </div>
          <div className={styles.statCard}>
            <a
              href="https://nearblocks.io/token/crans.tkn.near?tab=holders"
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: 'none' }}
            >
              <div className={styles.statLabel}>Holders</div>
              <div className={styles.statValue}>⧉⌝</div>
            </a>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>CRANS Total Supply</div>
            <div className={styles.statValue}>{cransTotalSupply}</div>
          </div>
        </div>

        <CransPrice />

        <div className={styles.poolsGrid}>
          {rawPoolData.map((pool: any, index) => {
            const poolData = pool.poolData;
            if (!poolData) return null;

            const tokenAccountIds = poolData.token_account_ids || [];
            const amounts = poolData.amounts || [];

            // Map amounts to configured token order (API order may differ per pool)
            const formattedAmount1 = formatTokenAmount(
              getPoolTokenAmount(amounts, tokenAccountIds, pool.token1),
              pool.token1
            );
            const formattedAmount2 = formatTokenAmount(
              getPoolTokenAmount(amounts, tokenAccountIds, pool.token2),
              pool.token2
            );

            const [token1Name, token2Name] = pool.name.split('/');
            const token1Metadata = tokenMetadata[pool.token1];
            const token2Metadata = tokenMetadata[pool.token2];

            // Pool-specific tag content
            const getPoolTag = (poolName: string) => {
              switch (poolName) {
                case 'CRANS/NEAR':
                  return {
                    href: "https://nearblocks.io/txns/9ee8QafZ33J4aFbQh4CD2T6MKr9BNKTRLF4ckCgGvScv#execution",
                    text: "Sep 2026",
                    icon: "🔒",
                    className: "locked"
                  };
                case 'CRANS/PUMPOPOLY':
                  return {
                    href: "https://near.pumpopoly.com/?invite=crans.near",
                    text: "Play & Earn",
                    icon: "🎮",
                    className: "play"
                  };
                case 'CRANS/SHITZU':
                  return {
                    href: "https://app.shitzuapes.xyz/stake",
                    text: "Stake & Earn",
                    icon: "💰",
                    className: "stake"
                  };
                case 'CRANS/SIN':
                  return {
                    href: "https://app.survivalisnear.xyz/",
                    text: "Stake $SIN",
                    icon: "💎",
                    className: "stake"
                  };
                case 'CRANS/BLACKDRAGON':
                  return {
                    href: "https://blackdragon.meme/whitepaper/",
                    text: "Whitepaper",
                    icon: "📄",
                    className: "docs"
                  };
                case 'CRANS/SHIT':
                  return {
                    href: "https://t.me/huggiesdotnear",
                    text: "Join $SHIT",
                    icon: "💩",
                    className: "community"
                  };
                default:
                  return null;
              }
            };

            const poolTag = getPoolTag(pool.name);

            return (
              <div key={index} className={styles.poolCard}>
                <div className={styles.poolHeader}>
                  <div className={styles.tokenIcons}>
                    {token1Metadata?.icon && (
                      <img 
                        src={token1Metadata.icon} 
                        alt={token1Name}
                        className={styles.tokenIcon}
                      />
                    )}
                    {token2Metadata?.icon && (
                      <img 
                        src={token2Metadata.icon} 
                        alt={token2Name}
                        className={styles.tokenIcon}
                      />
                    )}
                  </div>
                </div>

                <div className={styles.poolInfo}>
                  <span className={styles.tokenName}>{token1Name}</span>
                  <span className={styles.tokenAmount}>{formattedAmount1}</span>
                  
                  <span className={styles.tokenName}>{token2Name}</span>
                  <span className={styles.tokenAmount}>{formattedAmount2}</span>
                </div>

                <div className={styles.poolValue}>
                  {poolTag && (
                    <a
                      href={poolTag.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${styles.poolTag} ${styles[poolTag.className]}`}
                    >
                      <span>{poolTag.icon}</span>
                      {poolTag.text}
                    </a>
                  )}
                  ${pool.usdValue}
                </div>
              </div>
            );
          })}
        </div>

        <footer className={styles.footer}>
          <div className={styles.footerContent}>
            <div className={styles.githubLinks}>
              <a 
                href="https://github.com/cranspaul" 
                target="_blank" 
                rel="noopener noreferrer"
                className={styles.githubLink}
              >
                <img src="/git.png" alt="GitHub" className={styles.githubIcon} />
                @cranspaul
              </a>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className={styles.pairsContainer}>
      <h2 className={styles.pairsTitle}></h2>
      
      {isLoading ? (
        <div style={{ 
          backgroundColor: '#181825',
          width: '100vw',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '20px',
          position: 'fixed',
          top: 0,
          left: 0,
          zIndex: 1000
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #cdd6f4',
            borderTop: '4px solid #181825',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <p>Cash rules everything around me...</p>
        </div>
      ) : error ? (
        <div className={styles.errorState}>Error: {error}</div>
      ) : pairs.length === 0 ? (
        <div className={styles.emptyState}>No liquidity positions found for this account</div>
      ) : (
        <table className={styles.pairsTable}>
          <thead>
            <tr>
              <th>Pair</th>
              <th>Token</th>
              <th>LP Tokens[Shares]</th>
              <th>USD Value</th>
            </tr>
          </thead>
          <tbody>
            {pairs.map((pair, index) => (
              <tr key={index}>
                <td className={styles.pairCell}>
                  <div className={styles.pairIcons}>
                    <span className={`${styles.tokenIcon} ${styles[pair.token1Symbol.toLowerCase()]}`}></span>
                    <span className={`${styles.tokenIcon} ${styles[pair.token2Symbol.toLowerCase()]}`}></span>
                  </div>
                  {pair.pair}
                </td>
                <td className={styles.tokenCell}>
                  <div className={styles.tokenRow}>
                    <span className={styles.tokenSymbol}>{pair.token1Symbol}</span>
                    <span className={styles.tokenAmount}>{pair.token1Amount}</span>
                  </div>
                  <div className={styles.tokenRow}>
                    <span className={styles.tokenSymbol}>{pair.token2Symbol}</span>
                    <span className={styles.tokenAmount}>{pair.token2Amount}</span>
                  </div>
                </td>
                <td className={styles.lpCell}>
                  {pair.lpShares} 
                  <span className={styles.sharePercent}>({pair.sharesPercent}%)</span>
                  {pair.inLocked && <span className={styles.lockedBadge}>in Locked</span>}
                </td>
                <td className={styles.valueCell}>{pair.usdValue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
