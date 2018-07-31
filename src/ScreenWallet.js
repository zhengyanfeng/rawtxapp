import React, { Component } from "react";
import ReactMixin from "react-mixin";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from "react-native";
import Button from "react-native-button";
import { styles as theme } from "react-native-theme";
import TimerMixin from "react-timer-mixin";
import ComponentActionSheet from "./ComponentActionSheet";
import ComponentAskFeedback from "./ComponentAskFeedback";
import ComponentLogo from "./ComponentLogo.js";
import ComponentReceiveFaucet from "./ComponentReceiveFaucet.js";
import ComponentWalletOperations from "./ComponentWalletOperations.js";
import ComponentWelcome from "./ComponentWelcome";
import ScreenChannels from "./ScreenChannels.js";
import ScreenCreateChannel from "./ScreenCreateChannel.js";
import ScreenInvoices from "./ScreenInvoices";
import ScreenPayInvoice from "./ScreenPayInvoice.js";
import ScreenTransactions from "./ScreenTransactions.js";
import ScreenReceiveBlockchain from "./ScreenReceiveBlockchain.js";
import ScreenReceiveInvoice from "./ScreenReceiveInvoice.js";
import ScreenSendBlockchain from "./ScreenSendBlockchain.js";
import WalletShutdownBackground from "./WalletShutdownBackground.js";
import withLnd from "./withLnd.js";
import withTheme from "./withTheme.js";
import ScreenSend from "./ScreenSend";
import ScreenReceive from "./ScreenReceive";

let backgroundShutdown = <View />;
if (Platform.OS === "ios") {
  backgroundShutdown = <WalletShutdownBackground />;
}

class BaseSyncingBlock extends Component {
  constructor(props) {
    super(props);
    this.state = {};
  }
  componentDidMount() {
    this.graphInfoListener_ = this.props.walletListener.listenToGraphInfo(
      graphInfo => this.setState({ graphInfo })
    );
  }

  componentWillUnmount() {
    this.graphInfoListener_.remove();
  }

  render() {
    const { getinfo } = this.props;
    let status;
    let statusStyle;
    let blockchainSynced = false;
    if (getinfo && getinfo["synced_to_chain"]) {
      status = "Synced to the chain!";
      statusStyle = syncingStyles.syncedText;
      blockchainSynced = true;
    } else {
      status = "Syncing to the chain (some operations won't work)";
      if (getinfo && getinfo["block_height"]) {
        status += " (block height: " + getinfo["block_height"] + ")";
      }
      status += "...";
      statusStyle = syncingStyles.unsynced;
    }
    let lightningSynced = false;
    if (
      this.state.graphInfo &&
      this.state.graphInfo.num_nodes &&
      parseInt(this.state.graphInfo.num_nodes) > 500
    ) {
      lightningSynced = true;
    }
    return (
      <View style={[theme.container, syncingStyles.container]}>
        <Text style={[theme.accountHeader, statusStyle]}>{status}</Text>
        {blockchainSynced &&
          !lightningSynced && (
            <Text style={[theme.accountHeader, syncingStyles.unsynced]}>
              Syncing with lightning peers (lightning operations won't work for
              now)...
            </Text>
          )}
      </View>
    );
  }
}

const SyncingBlock = withLnd(BaseSyncingBlock);

class CheckingAccount extends Component {
  constructor(props) {
    super(props);
    this.state = {};
  }

  componentDidMount() {
    this.balanceListener_ = this.props.walletListener.listenToBalanceChannels(
      balance => this.setState({ balance })
    );
    this.pendingChannelListener_ = this.props.walletListener.listenToPendingChannels(
      pendingChannel => this.setState({ pendingChannel })
    );
    this.channelListener_ = this.props.walletListener.listenToChannels(
      ({ channels }) => this.setState({ channels })
    );
    this.getRunningWallet();
  }

  componentWillUnmount() {
    this.balanceListener_.remove();
    this.pendingChannelListener_.remove();
    this.channelListener_.remove();
  }

  getRunningWallet = async () => {
    const runningWallet = await this.props.getRunningWallet();
    this.setState({ runningWallet });
  };

  _renderChannelCount = () => {
    let total = 0;
    let active = 0;
    let pending_open = 0;
    let pending_close = 0;
    if (this.state.channels) {
      const c = this.state.channels;
      total = c.length;
      for (let i = 0; i < c.length; i++) {
        if (c[i].active) {
          active++;
        }
      }
    }

    if (this.state.pendingChannel) {
      const {
        pending_open_channels,
        pending_closing_channels,
        pending_force_closing_channels
      } = this.state.pendingChannel;
      pending_open =
        (pending_open_channels && pending_open_channels.length) || 0;
      pending_close =
        pending_closing_channels && pending_closing_channels.length;
      pending_force_close =
        pending_force_closing_channels && pending_force_closing_channels.length;
      pending_close = (pending_close || 0) + (pending_force_close || 0);
    }
    const inactive = total - active;
    const hasPending = pending_open > 0 || pending_close > 0 || inactive > 0;

    return (
      <View>
        <Text>
          <Text style={[theme.infoLabel]}>Channels </Text>
          <Text style={theme.infoValue}>{active}</Text>
          {hasPending && (
            <Text style={theme.infoValue}>
              {" "}
              ({inactive > 0
                ? "inactive: " +
                  inactive +
                  (pending_open > 0 || pending_close > 0 ? ", " : "")
                : ""}
              {pending_open > 0
                ? "opening: " + pending_open + (pending_close > 0 ? ", " : "")
                : ""}
              {pending_close > 0 ? "closing: " + pending_close : ""})
            </Text>
          )}
        </Text>
      </View>
    );
  };

  _renderBalances = () => {
    const pendingOpen =
      this.state.balance && parseInt(this.state.balance.pending_open_balance);
    const limbo =
      this.state.pendingChannel &&
      parseInt(this.state.pendingChannel.total_limbo_balance);
    const hasOpen = pendingOpen > 0;
    const hasLimbo = limbo > 0;
    const hasOpenLimbo = hasOpen || hasLimbo;
    return (
      <View>
        <Text style={theme.baseText}>
          <Text style={[theme.infoLabel]}>Balance </Text>
          <Text style={theme.infoValue}>
            {this.props.displaySatoshi(
              (this.state.balance && this.state.balance.balance) || "0"
            )}
            {hasOpenLimbo && (
              <Text>
                {" "}
                ({hasOpen
                  ? "pending: +" +
                    this.props.displaySatoshi(pendingOpen) +
                    (hasLimbo ? ", " : "")
                  : ""}
                {hasLimbo ? "limbo: " + this.props.displaySatoshi(limbo) : ""})
              </Text>
            )}
          </Text>
        </Text>
      </View>
    );
  };

  _renderFaucet = () => {
    if (
      !this.state.runningWallet ||
      this.state.runningWallet.coin != "bitcoin" ||
      this.state.runningWallet.network != "testnet"
    ) {
      return;
    }
    return <ComponentReceiveFaucet />;
  };

  _renderShowPayments = () => {
    const closeModal = () => this.setState({ showingPayments: false });
    return (
      <ComponentActionSheet
        visible={!!this.state.showingPayments}
        onRequestClose={closeModal}
        animationType="slide"
        buttonText="Done"
        title="Payments"
      >
        <ScreenTransactions onCancel={closeModal} />
      </ComponentActionSheet>
    );
  };

  _renderShowInvoices = () => {
    const closeModal = () => this.setState({ showingInvoices: false });
    return (
      <ComponentActionSheet
        visible={!!this.state.showingInvoices}
        onRequestClose={closeModal}
        animationType="slide"
        buttonText="Done"
        title="Invoices"
      >
        <ScreenInvoices onCancel={closeModal} />
      </ComponentActionSheet>
    );
  };

  _renderChannels = () => {
    const closeModal = () => this.setState({ showingChannels: false });
    return (
      <ComponentActionSheet
        visible={!!this.state.showingChannels}
        onRequestClose={closeModal}
        animationType="slide"
        buttonText="Done"
        title="Channels"
      >
        <ScreenChannels onCancel={closeModal} />
      </ComponentActionSheet>
    );
  };

  render() {
    return (
      <Animated.View
        style={[
          theme.container,
          styles.container,
          {
            opacity: this.props.showAnim,
            transform: [
              {
                translateY: this.props.showAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [800, 0]
                })
              }
            ]
          }
        ]}
      >
        <View style={styles.headerTitleContainer}>
          <Image
            source={require("../assets/lightning.png")}
            style={styles.headerIcon}
          />
          <Text style={theme.accountHeader}>Lightning account</Text>
        </View>
        {this._renderBalances()}
        {this._renderChannelCount()}
        <View style={{ flexDirection: "row" }}>
          <Button
            containerStyle={theme.smallActionButton}
            style={theme.smallActionButtonText}
            onPress={() => {
              this.setState({
                showingPayments: true
              });
            }}
          >
            Payments
          </Button>
          <Button
            containerStyle={theme.smallActionButton}
            style={theme.smallActionButtonText}
            onPress={() => {
              this.setState({
                showingInvoices: true
              });
            }}
          >
            Invoices
          </Button>
        </View>
        <View style={{ flexDirection: "row" }}>
          <Button
            containerStyle={theme.smallActionButton}
            style={theme.smallActionButtonText}
            onPress={() => {
              this.setState({
                showingChannels: true
              });
            }}
          >
            Channels
          </Button>
        </View>
        {this._renderFaucet()}
        {this._renderShowPayments()}
        {this._renderShowInvoices()}
        {this._renderChannels()}
      </Animated.View>
    );
  }
}

const CheckingAccountWithLnd = withLnd(CheckingAccount);

class SavingsAccount extends Component {
  constructor(props) {
    super(props);
    this.state = {
      balance: {},
      generatedAddress: "",
      showingGeneratedAddress: false,
      showingSelectPeers: false,
      showingTransferToChecking: false
    };
  }
  componentDidMount() {
    this.balanceListener_ = this.props.walletListener.listenToBalanceBlockchain(
      balance => this.setState({ balance })
    );
    this.pendingChannelListener_ = this.props.walletListener.listenToPendingChannels(
      pendingChannel => this.setState({ pendingChannel })
    );
  }
  componentWillUnmount() {
    this.balanceListener_.remove();
    this.pendingChannelListener_.remove();
  }

  _renderBalances = () => {
    const unconfirmed =
      (this.state.balance &&
        parseInt(this.state.balance.unconfirmed_balance)) ||
      0;
    return (
      <View>
        <Text style={theme.baseText}>
          <Text style={theme.infoLabel}>Balance </Text>
          <Text style={theme.infoValue}>
            {this.props.displaySatoshi(
              (this.state.balance && this.state.balance.confirmed_balance) ||
                "0"
            )}
            {unconfirmed > 0 && (
              <Text>
                {" "}
                (unconfirmed: {this.props.displaySatoshi(unconfirmed)})
              </Text>
            )}
          </Text>
        </Text>
        {this.state.pendingChannel &&
          this.state.pendingChannel.pending_open_channels &&
          this.state.pendingChannel.pending_open_channels.length > 0 && (
            <Text style={theme.warningText}>
              Your balance could be lower than expected during channel opening,
              will be accurate after channel is open!
            </Text>
          )}
      </View>
    );
  };

  _renderTransfer = () => {
    const closeModal = () => this.setState({ showingTransfer: false });
    return (
      <ComponentActionSheet
        visible={!!this.state.showingTransfer}
        onRequestClose={closeModal}
        animationType="slide"
        buttonText="Done"
        title="New channel"
      >
        <ScreenCreateChannel onCancel={closeModal} />
      </ComponentActionSheet>
    );
  };

  render() {
    return (
      <Animated.View
        style={[
          theme.container,
          styles.container,
          {
            opacity: this.props.showAnim,
            transform: [
              {
                translateY: this.props.showAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [800, 0]
                })
              }
            ]
          }
        ]}
      >
        <View style={styles.headerTitleContainer}>
          <Image
            source={require("../assets/blockchain.png")}
            style={styles.headerIcon}
          />
          <Text style={theme.accountHeader}>Blockchain account</Text>
        </View>

        {this._renderBalances()}
        <View style={{ flexDirection: "row" }}>
          <Button
            containerStyle={theme.smallActionButton}
            style={theme.smallActionButtonText}
            onPress={() => {
              this.setState({
                showingTransfer: true
              });
            }}
          >
            New channel
          </Button>
        </View>

        {this._renderTransfer()}
      </Animated.View>
    );
  }
}

const SavingsAccountWithLnd = withLnd(SavingsAccount);

class ScreenWallet extends Component {
  constructor(props) {
    super(props);
    this.state = {
      wallet: undefined,
      getinfo: undefined,
      working: false,
      showAnim: new Animated.Value(0)
    };
  }

  componentDidMount() {
    this.setRunningWallet();
    this.props.walletListener.startWatching();
    this.getInfoListener_ = this.props.walletListener.listenToGetInfo(
      getinfo => {
        this.setState({ getinfo });
      }
    );
    Animated.spring(this.state.showAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 10,
      tension: 20
    }).start();
  }

  componentWillUnmount() {
    this.getInfoListener_.remove();
    this.props.walletListener.stopWatching();
  }

  setRunningWallet = async () => {
    if (!this.state.wallet) {
      try {
        const wallet = await this.props.getRunningWallet();
        this.setState({ wallet });
      } catch (err) {
        this.setTimeout(this.setRunningWallet, 1000);
      }
    }
  };

  _renderSend = () => {
    const closeModal = () => this.setState({ showingSend: false });
    return (
      <ComponentActionSheet
        visible={!!this.state.showingSend}
        onRequestClose={closeModal}
        animationType="slide"
        buttonText="Done"
        title="Send"
      >
        <ScreenSend />
      </ComponentActionSheet>
    );
  };

  _renderReceive = () => {
    const closeModal = () => this.setState({ showingReceive: false });
    return (
      <ComponentActionSheet
        visible={!!this.state.showingReceive}
        onRequestClose={closeModal}
        animationType="slide"
        buttonText="Done"
        title="Receive"
      >
        <ScreenReceive />
      </ComponentActionSheet>
    );
  };

  _renderSendReceive = () => {
    return (
      <View>
        {this._renderSend()}
        {this._renderReceive()}
        <Animated.View
          style={[
            styles.sendReceiveContainer,
            {
              opacity: this.state.showAnim,
              transform: [
                {
                  translateY: this.state.showAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [100, 0]
                  })
                }
              ]
            }
          ]}
        >
          <TouchableOpacity
            onPress={() => this.setState({ showingSend: true })}
            style={[
              theme.sendButton,
              styles.actionButtonContainer,
              styles.sendButton
            ]}
          >
            <View>
              <Text style={styles.actionText}>Send</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => this.setState({ showingReceive: true })}
            style={[
              theme.receiveButton,
              styles.actionButtonContainer,
              styles.receiveButton
            ]}
          >
            <View>
              <Text style={styles.actionText}>Receive</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  };

  render() {
    let content;

    let footer = (
      <View>
        <Button
          style={[styles.closeWalletButton]}
          containerStyle={theme.container}
          onPress={async () => {
            this.setState({ working: true }, async () => {
              await this.props.stopLndFromWallet(this.state.wallet);
              if (Platform.OS == "ios") {
                // because lnd process isn't isolated on ios, after "closing"
                // the wallet, there is still lnd process related things
                // lingering in the background. For now, when the wallet
                // is closed, just display a wallet closed screen and the user
                // can click home button which will close the app and shut it
                // down completely and they can reopen another wallet by reopening
                // the app, less than ideal, should be fixed.
                this.setState({ iosWalletClosed: true });
                return;
              }
              this.props.navigation.navigate("Intro");
            });
          }}
        >
          Close wallet
        </Button>
      </View>
    );

    if (this.state.iosWalletClosed) {
      content = (
        <View style={theme.container}>
          <Text style={theme.accountHeader}>Wallet closed!</Text>
        </View>
      );
    } else if (
      !this.state.wallet ||
      !this.state.getinfo ||
      this.state.working
    ) {
      content = (
        <View>
          <ActivityIndicator color={this.props.spinnerOnBackgroundColor} />
        </View>
      );
    } else {
      // TODO: add welcome and feedback components back.
      // <ComponentWelcome />
      // <ComponentAskFeedback />
      content = (
        <View style={styles.container}>
          <View style={styles.container}>
            <CheckingAccountWithLnd showAnim={this.state.showAnim} />
          </View>
          <View style={styles.container}>
            <SavingsAccountWithLnd showAnim={this.state.showAnim} />
          </View>
          {footer}
          {this._renderSendReceive()}
        </View>
      );
    }

    return (
      <View style={[styles.container, theme.appBackground]}>
        {backgroundShutdown}
        <Animated.View
          style={{
            flex: 0,
            transform: [
              {
                translateY: this.state.showAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-200, 0]
                })
              }
            ]
          }}
        >
          <ComponentLogo
            noSlogan={true}
            imageStyles={theme.logoOnLightBackground}
            useSmallLogo={true}
          />
        </Animated.View>
        <View style={styles.restContainer}>{content}</View>
      </View>
    );
  }
}
ReactMixin(ScreenWallet.prototype, TimerMixin);
export default withTheme(withLnd(ScreenWallet));

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  logoContainer: {
    flex: 1
  },
  restContainer: {
    flex: 8
  },
  closeWalletButton: {
    color: "red"
  },
  sendReceiveContainer: {
    flexDirection: "row"
  },
  actionButtonContainer: {
    padding: 10,
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 10
  },
  actionText: {
    fontSize: 22,
    fontWeight: "700",
    color: "white"
  },
  receiveButton: {
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    marginRight: 10
  },
  sendButton: {
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
    marginLeft: 10
  },
  headerTitleContainer: {
    flexDirection: "row",
    alignItems: "center"
  },
  headerIcon: {
    width: 20,
    height: 20,
    marginRight: 5
  }
});

const syncingStyles = StyleSheet.create({
  syncedText: {
    color: "green"
  },
  unsynced: {
    color: "orange"
  },
  container: {
    marginTop: 0
  }
});
