# mux-staking


## Overview 

User => RewardRouter 
             \_ stake MLP => FeeRewardTracker (ERC20) => MuxRewardTracker (ERC20) 
             \_ stake MUX => VotingEscrow (ERC20: VEMUX)
                                    \_ FeeMuxRewardTracker
                                    \_ MuxMuxRewardTracker
             \_ vest ESMUX [ESMUX => MUX]
                        \_ MLP Vester
                        \_ MUX Vester

Admin => RewardManager         
             \_ FeeDistributor     
             \_ MuxDistributor