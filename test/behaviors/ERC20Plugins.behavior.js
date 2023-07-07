const { expect, constants } = require('@1inch/solidity-utils');
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers');
const { ethers } = require('hardhat');

function shouldBehaveLikeERC20Plugins (initContracts) {
    // Behavior test scenarios
    describe('should behave like ERC20 plugins', function () {
        let wallet1, wallet2;

        before(async function () {
            [wallet1, wallet2] = await ethers.getSigners();
        });

        async function initAndCreatePlugins () {
            const { erc20Plugins, PLUGIN_COUNT_LIMITS, amount } = await initContracts();

            const PluginMock = await ethers.getContractFactory('PluginMock');
            const plugins = [];
            for (let i = 0; i < PLUGIN_COUNT_LIMITS; i++) {
                plugins[i] = await PluginMock.deploy(`PLUGIN_TOKEN_${i}`, `PT${i}`, erc20Plugins.address);
                await plugins[i].deployed();
            }
            return { erc20Plugins, plugins, amount };
        }

        async function initAndAddAllPlugins () {
            const { erc20Plugins, plugins, amount } = await initAndCreatePlugins();
            for (let i = 0; i < plugins.length; i++) {
                await erc20Plugins.connect(wallet1).addPlugin(plugins[i].address);
                await erc20Plugins.connect(wallet2).addPlugin(plugins[i].address);
            }
            return { erc20Plugins, plugins, amount };
        }

        async function initAndAddOnePlugin () {
            const { erc20Plugins, plugins, amount } = await initAndCreatePlugins();
            await erc20Plugins.connect(wallet1).addPlugin(plugins[0].address);
            await erc20Plugins.connect(wallet2).addPlugin(plugins[0].address);
            return { erc20Plugins, plugins, amount };
        };

        async function initWrongPlugin () {
            const { erc20Plugins, amount } = await initContracts();
            const BadPluginMock = await ethers.getContractFactory('BadPluginMock');
            const wrongPlugin = await BadPluginMock.deploy('BadPluginMock', 'WPM', erc20Plugins.address);
            await wrongPlugin.deployed();
            return { erc20Plugins, wrongPlugin, amount };
        };

        describe('view methods', function () {
            it('hasPlugin should return true when plugin added by wallet', async function () {
                const { erc20Plugins, plugins } = await loadFixture(initAndCreatePlugins);
                await erc20Plugins.addPlugin(plugins[0].address);
                expect(await erc20Plugins.hasPlugin(wallet1.address, plugins[0].address)).to.be.equals(true);
                expect(await erc20Plugins.hasPlugin(wallet2.address, plugins[0].address)).to.be.equals(false);
            });

            it('pluginsCount should return plugins amount which wallet using', async function () {
                const { erc20Plugins, plugins } = await loadFixture(initAndCreatePlugins);
                for (let i = 0; i < plugins.length; i++) {
                    await erc20Plugins.addPlugin(plugins[i].address);
                    expect(await erc20Plugins.pluginsCount(wallet1.address)).to.be.equals(i + 1);
                }
                for (let i = 0; i < plugins.length; i++) {
                    await erc20Plugins.removePlugin(plugins[i].address);
                    expect(await erc20Plugins.pluginsCount(wallet1.address)).to.be.equals(plugins.length - (i + 1));
                }
            });

            it('pluginAt should return plugin by added plugins index', async function () {
                const { erc20Plugins, plugins } = await loadFixture(initAndCreatePlugins);
                for (let i = 0; i < plugins.length; i++) {
                    await erc20Plugins.addPlugin(plugins[i].address);
                    expect(await erc20Plugins.pluginAt(wallet1.address, i)).to.be.equals(plugins[i].address);
                    expect(await erc20Plugins.pluginAt(wallet1.address, i + 1)).to.be.equals(constants.ZERO_ADDRESS);
                }
                for (let i = plugins.length - 1; i >= 0; i--) {
                    await erc20Plugins.removePlugin(plugins[i].address);
                    for (let j = 0; j < plugins.length; j++) {
                        expect(await erc20Plugins.pluginAt(wallet1.address, j))
                            .to.be.equals(
                                j >= i
                                    ? constants.ZERO_ADDRESS
                                    : plugins[j].address,
                            );
                    };
                }
            });

            it('plugins should return array of plugins by wallet', async function () {
                const { erc20Plugins, plugins } = await loadFixture(initAndCreatePlugins);
                const pluginsAddrs = plugins.map(plugin => plugin.address);
                for (let i = 0; i < plugins.length; i++) {
                    await erc20Plugins.addPlugin(plugins[i].address);
                    expect(await erc20Plugins.plugins(wallet1.address)).to.be.deep.equals(pluginsAddrs.slice(0, i + 1));
                }
            });

            describe('pluginBalanceOf', function () {
                it('should not return balance for non-added plugin', async function () {
                    const { erc20Plugins, plugins, amount } = await loadFixture(initAndCreatePlugins);
                    expect(await erc20Plugins.balanceOf(wallet1.address)).to.be.equals(amount);
                    expect(await erc20Plugins.pluginBalanceOf(plugins[0].address, wallet1.address)).to.be.equals('0');
                });

                it('should return balance for added plugin', async function () {
                    const { erc20Plugins, plugins, amount } = await loadFixture(initAndCreatePlugins);
                    await erc20Plugins.addPlugin(plugins[0].address);
                    expect(await erc20Plugins.balanceOf(wallet1.address)).to.be.equals(amount);
                    expect(await erc20Plugins.pluginBalanceOf(plugins[0].address, wallet1.address)).to.be.equals(amount);
                });

                it('should not return balance for removed plugin', async function () {
                    const { erc20Plugins, plugins, amount } = await loadFixture(initAndCreatePlugins);
                    await erc20Plugins.addPlugin(plugins[0].address);
                    await erc20Plugins.removePlugin(plugins[0].address);
                    expect(await erc20Plugins.balanceOf(wallet1.address)).to.be.equals(amount);
                    expect(await erc20Plugins.pluginBalanceOf(plugins[0].address, wallet1.address)).to.be.equals('0');
                });
            });
        });

        describe('addPlugin', function () {
            it('should not add plugin with zero-address', async function () {
                const { erc20Plugins } = await loadFixture(initContracts);
                await expect(erc20Plugins.addPlugin(constants.ZERO_ADDRESS))
                    .to.be.revertedWithCustomError(erc20Plugins, 'InvalidPluginAddress');
            });

            it('should add plugin', async function () {
                const { erc20Plugins, plugins } = await loadFixture(initAndCreatePlugins);
                expect(await erc20Plugins.hasPlugin(wallet1.address, plugins[0].address)).to.be.equals(false);
                await erc20Plugins.addPlugin(plugins[0].address);
                expect(await erc20Plugins.hasPlugin(wallet1.address, plugins[0].address)).to.be.equals(true);
            });

            it('should not add plugin twice from one wallet', async function () {
                const { erc20Plugins, plugins } = await loadFixture(initAndCreatePlugins);
                await erc20Plugins.addPlugin(plugins[0].address);
                await expect(erc20Plugins.addPlugin(plugins[0].address))
                    .to.be.revertedWithCustomError(erc20Plugins, 'PluginAlreadyAdded');
            });

            it('should add the same plugin for different wallets', async function () {
                const { erc20Plugins, plugins } = await loadFixture(initAndCreatePlugins);
                expect(await erc20Plugins.hasPlugin(wallet1.address, plugins[0].address)).to.be.equals(false);
                expect(await erc20Plugins.hasPlugin(wallet2.address, plugins[0].address)).to.be.equals(false);
                await erc20Plugins.addPlugin(plugins[0].address);
                await erc20Plugins.connect(wallet2).addPlugin(plugins[0].address);
                expect(await erc20Plugins.hasPlugin(wallet1.address, plugins[0].address)).to.be.equals(true);
                expect(await erc20Plugins.hasPlugin(wallet2.address, plugins[0].address)).to.be.equals(true);
            });

            it('should add different plugin', async function () {
                const { erc20Plugins, plugins } = await loadFixture(initAndCreatePlugins);
                expect(await erc20Plugins.hasPlugin(wallet1.address, plugins[0].address)).to.be.equals(false);
                expect(await erc20Plugins.hasPlugin(wallet1.address, plugins[1].address)).to.be.equals(false);
                await erc20Plugins.addPlugin(plugins[0].address);
                await erc20Plugins.addPlugin(plugins[1].address);
                expect(await erc20Plugins.plugins(wallet1.address)).to.have.deep.equals([plugins[0].address, plugins[1].address]);
            });

            it('should updateBalance via plugin only for wallets with non-zero balance', async function () {
                const { erc20Plugins, plugins, amount } = await loadFixture(initAndCreatePlugins);
                expect(await erc20Plugins.balanceOf(wallet1.address)).to.be.equals(amount);
                expect(await erc20Plugins.balanceOf(wallet2.address)).to.be.equals('0');
                // addPlugin for wallet with balance
                expect(await plugins[0].balanceOf(wallet1.address)).to.be.equals('0');
                await erc20Plugins.addPlugin(plugins[0].address);
                expect(await plugins[0].balanceOf(wallet1.address)).to.be.equals(amount);
                // addPlugin for wallet without balance
                expect(await plugins[0].balanceOf(wallet2.address)).to.be.equals('0');
                await erc20Plugins.connect(wallet2).addPlugin(plugins[0].address);
                expect(await plugins[0].balanceOf(wallet2.address)).to.be.equals('0');
            });
        });

        describe('removePlugin', function () {
            it('should not remove non-added plugin', async function () {
                const { erc20Plugins, plugins } = await loadFixture(initAndAddOnePlugin);
                await expect(erc20Plugins.removePlugin(plugins[1].address))
                    .to.be.revertedWithCustomError(erc20Plugins, 'PluginNotFound');
            });

            it('should remove plugin', async function () {
                const { erc20Plugins, plugins } = await loadFixture(initAndAddOnePlugin);
                expect(await erc20Plugins.hasPlugin(wallet1.address, plugins[0].address)).to.be.equals(true);
                await erc20Plugins.removePlugin(plugins[0].address);
                expect(await erc20Plugins.hasPlugin(wallet1.address, plugins[0].address)).to.be.equals(false);
            });

            it('should updateBalance via plugin only for wallets with non-zero balance', async function () {
                const { erc20Plugins, plugins, amount } = await loadFixture(initAndAddOnePlugin);
                expect(await erc20Plugins.balanceOf(wallet1.address)).to.be.equals(amount);
                expect(await erc20Plugins.balanceOf(wallet2.address)).to.be.equals('0');
                // removePlugin for wallet with balance
                await erc20Plugins.removePlugin(plugins[0].address);
                expect(await plugins[0].balanceOf(wallet1.address)).to.be.equals('0');
                // removePlugin for wallet without balance
                await erc20Plugins.connect(wallet2).removePlugin(plugins[0].address);
                expect(await plugins[0].balanceOf(wallet2.address)).to.be.equals('0');
            });
        });

        describe('removeAllPlugins', function () {
            it('should remove all plugins', async function () {
                const { erc20Plugins, plugins } = await loadFixture(initAndAddAllPlugins);
                expect(await erc20Plugins.pluginsCount(wallet1.address)).to.be.equals(plugins.length);
                await erc20Plugins.removeAllPlugins();
                expect(await erc20Plugins.pluginsCount(wallet1.address)).to.be.equals(0);
            });
        });

        describe('_updateBalances', function () {
            it('should not fail when updateBalance in plugin reverts', async function () {
                const { erc20Plugins, wrongPlugin } = await loadFixture(initWrongPlugin);
                await wrongPlugin.setIsRevert(true);
                await erc20Plugins.addPlugin(wrongPlugin.address);
                expect(await erc20Plugins.plugins(wallet1.address)).to.have.deep.equals([wrongPlugin.address]);
            });

            it('should not fail when updateBalance in plugin has OutOfGas', async function () {
                const { erc20Plugins, wrongPlugin } = await loadFixture(initWrongPlugin);
                await wrongPlugin.setOutOfGas(true);
                await erc20Plugins.addPlugin(wrongPlugin.address);
                expect(await erc20Plugins.plugins(wallet1.address)).to.have.deep.equals([wrongPlugin.address]);
            });
        });

        it('should not add more plugins than limit', async function () {
            const { erc20Plugins, plugins } = await loadFixture(initAndCreatePlugins);
            const pluginsCountLimit = await erc20Plugins.pluginsCountLimit();
            for (let i = 0; i < pluginsCountLimit; i++) {
                await erc20Plugins.addPlugin(plugins[i].address);
            }

            const PluginMock = await ethers.getContractFactory('PluginMock');
            const extraPlugin = await PluginMock.deploy('EXTRA_PLUGIN_TOKEN', 'EPT', erc20Plugins.address);
            await extraPlugin.deployed();

            await expect(erc20Plugins.addPlugin(extraPlugin.address))
                .to.be.revertedWithCustomError(erc20Plugins, 'PluginsLimitReachedForAccount');
        });
    });
};

function shouldBehaveLikeERC20PluginsTransfers (initContracts) {
    // Behavior test scenarios
    describe('transfers should behave like ERC20 plugins transfers', function () {
        let wallet1, wallet2, wallet3;

        before(async function () {
            [wallet1, wallet2, wallet3] = await ethers.getSigners();
        });

        async function initAndCreatePlugins () {
            const { erc20Plugins, PLUGIN_COUNT_LIMITS, amount } = await initContracts();

            const PluginMock = await ethers.getContractFactory('PluginMock');
            const plugins = [];
            for (let i = 0; i < PLUGIN_COUNT_LIMITS; i++) {
                plugins[i] = await PluginMock.deploy(`PLUGIN_TOKEN_${i}`, `PT${i}`, erc20Plugins.address);
                await plugins[i].deployed();
            }
            return { erc20Plugins, plugins, amount };
        }

        async function initAndAddPlugins () {
            const { erc20Plugins, plugins, amount } = await initAndCreatePlugins();
            for (let i = 0; i < plugins.length; i++) {
                await erc20Plugins.connect(wallet1).addPlugin(plugins[i].address);
            }
            return { erc20Plugins, plugins, amount };
        };

        describe('_afterTokenTransfer', function () {
            it('should not affect when amount is zero', async function () {
                const { erc20Plugins, plugins, amount } = await loadFixture(initAndAddPlugins);
                for (let i = 0; i < plugins.length; i++) {
                    expect(await plugins[i].balanceOf(wallet1.address)).to.be.equals(amount);
                    expect(await plugins[i].balanceOf(wallet2.address)).to.be.equals('0');
                }
                await erc20Plugins.transfer(wallet2.address, '0');
                for (let i = 0; i < plugins.length; i++) {
                    expect(await plugins[i].balanceOf(wallet1.address)).to.be.equals(amount);
                    expect(await plugins[i].balanceOf(wallet2.address)).to.be.equals('0');
                }
            });

            it('should not affect when sender equals to recipient', async function () {
                const { erc20Plugins, plugins, amount } = await loadFixture(initAndAddPlugins);
                await erc20Plugins.transfer(wallet1.address, amount);
                for (let i = 0; i < plugins.length; i++) {
                    expect(await plugins[i].balanceOf(wallet1.address)).to.be.equals(amount);
                }
            });

            it('should not affect recipient and affect sender: recipient without plugins, sender with plugins', async function () {
                const { erc20Plugins, plugins, amount } = await loadFixture(initAndAddPlugins);
                const wallet1beforeBalance = await erc20Plugins.balanceOf(wallet1.address);
                const wallet2beforeBalance = await erc20Plugins.balanceOf(wallet2.address);
                for (let i = 0; i < plugins.length; i++) {
                    expect(await plugins[i].balanceOf(wallet1.address)).to.be.equals(amount);
                    expect(await plugins[i].balanceOf(wallet2.address)).to.be.equals('0');
                }
                await erc20Plugins.transfer(wallet2.address, amount);
                for (let i = 0; i < plugins.length; i++) {
                    expect(await plugins[i].balanceOf(wallet1.address)).to.be.equals('0');
                    expect(await plugins[i].balanceOf(wallet2.address)).to.be.equals('0');
                }
                expect(await erc20Plugins.balanceOf(wallet1.address)).to.be.equals(wallet1beforeBalance.sub(amount));
                expect(await erc20Plugins.balanceOf(wallet2.address)).to.be.equals(wallet2beforeBalance.add(amount));
            });

            it('should affect recipient and not affect sender: recipient with plugins, sender without plugins', async function () {
                const { erc20Plugins, plugins, amount } = await loadFixture(initAndAddPlugins);
                await erc20Plugins.transfer(wallet2.address, amount);
                for (let i = 0; i < plugins.length; i++) {
                    expect(await plugins[i].balanceOf(wallet1.address)).to.be.equals('0');
                    expect(await plugins[i].balanceOf(wallet2.address)).to.be.equals('0');
                }
                const wallet1beforeBalance = await erc20Plugins.balanceOf(wallet1.address);
                const wallet2beforeBalance = await erc20Plugins.balanceOf(wallet2.address);
                await erc20Plugins.connect(wallet2).transfer(wallet1.address, amount);
                for (let i = 0; i < plugins.length; i++) {
                    expect(await plugins[i].balanceOf(wallet1.address)).to.be.equals(amount);
                    expect(await plugins[i].balanceOf(wallet2.address)).to.be.equals('0');
                }
                expect(await erc20Plugins.balanceOf(wallet1.address)).to.be.equals(wallet1beforeBalance.add(amount));
                expect(await erc20Plugins.balanceOf(wallet2.address)).to.be.equals(wallet2beforeBalance.sub(amount));
            });

            it('should not affect recipient and sender: recipient without plugins, sender without plugins', async function () {
                const { erc20Plugins, plugins, amount } = await loadFixture(initAndAddPlugins);
                await erc20Plugins.mint(wallet2.address, amount);
                const wallet2beforeBalance = await erc20Plugins.balanceOf(wallet2.address);
                const wallet3beforeBalance = await erc20Plugins.balanceOf(wallet3.address);
                await erc20Plugins.connect(wallet2).transfer(wallet3.address, amount);
                for (let i = 0; i < plugins.length; i++) {
                    expect(await plugins[i].balanceOf(wallet2.address)).to.be.equals('0');
                    expect(await plugins[i].balanceOf(wallet3.address)).to.be.equals('0');
                }
                expect(await erc20Plugins.balanceOf(wallet2.address)).to.be.equals(wallet2beforeBalance.sub(amount));
                expect(await erc20Plugins.balanceOf(wallet3.address)).to.be.equals(wallet3beforeBalance.add(amount));
            });

            it('should affect recipient and sender with different plugins', async function () {
                const { erc20Plugins, plugins, amount } = await loadFixture(initAndCreatePlugins);

                const pluginsBalancesBeforeWallet1 = [];
                const pluginsBalancesBeforeWallet2 = [];
                for (let i = 0; i < plugins.length; i++) {
                    if (i <= plugins.length / 2 + 2) {
                        await erc20Plugins.connect(wallet1).addPlugin(plugins[i].address);
                    }
                    if (i >= plugins.length / 2 - 2) {
                        await erc20Plugins.connect(wallet2).addPlugin(plugins[i].address);
                    }
                    pluginsBalancesBeforeWallet1[i] = await plugins[i].balanceOf(wallet1.address);
                    pluginsBalancesBeforeWallet2[i] = await plugins[i].balanceOf(wallet2.address);
                }

                const wallet1beforeBalance = await erc20Plugins.balanceOf(wallet1.address);
                const wallet2beforeBalance = await erc20Plugins.balanceOf(wallet2.address);

                await erc20Plugins.connect(wallet1).transfer(wallet2.address, amount);

                for (let i = 0; i < plugins.length; i++) {
                    expect(await plugins[i].balanceOf(wallet1.address))
                        .to.be.equals(
                            i <= plugins.length / 2 + 2
                                ? pluginsBalancesBeforeWallet1[i].sub(amount)
                                : '0',
                        );
                    expect(await plugins[i].balanceOf(wallet2.address))
                        .to.be.equals(
                            i >= plugins.length / 2 - 2
                                ? pluginsBalancesBeforeWallet2[i].add(amount)
                                : '0',
                        );
                }
                expect(await erc20Plugins.balanceOf(wallet1.address)).to.be.equals(wallet1beforeBalance.sub(amount));
                expect(await erc20Plugins.balanceOf(wallet2.address)).to.be.equals(wallet2beforeBalance.add(amount));
            });
        });
    });
};

module.exports = {
    shouldBehaveLikeERC20Plugins,
    shouldBehaveLikeERC20PluginsTransfers,
};
