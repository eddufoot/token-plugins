// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IPod {
    function updateBalances(address from, address to, uint256 amount) external;
    function updateBalancesWithTokenId(address from, address to, uint256 amount, uint256 id) external;
}
