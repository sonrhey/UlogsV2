import React, { PropTypes } from 'react';
import { connect } from 'react-redux';
import { IntlProvider } from 'react-intl';
import { Layout } from 'antd';
import { GatewayProvider, GatewayDest } from 'react-gateway';
import { withRouter } from 'react-router-dom';
import { login } from './auth/authActions';
import { getConfig, getRate } from './actions';
import steemAPI from './steemAPI';
import { getMessages, getLocale } from './translations/translationHelper';
import Topnav from './components/Navigation/Topnav';
import * as reblogActions from './app/Reblog/reblogActions';
import config from '../config.json';
import './translations/Translations';

@withRouter
@connect(
  state => ({
    app: state.app,
    auth: state.auth,
  }),
  {
    login,
    getConfig,
    getRate,
    getRebloggedList: reblogActions.getRebloggedList,
  },
)
export default class Wrapper extends React.PureComponent {
  static propTypes = {
    app: PropTypes.shape().isRequired,
    auth: PropTypes.shape().isRequired,
    children: PropTypes.element.isRequired,
    login: PropTypes.func,
    getConfig: PropTypes.func,
    getRebloggedList: PropTypes.func,
    getRate: PropTypes.func,
  }

  static defaultProps = {
    login: () => {},
    getConfig: () => {},
    getRebloggedList: () => {},
    getRate: () => {},
  }

  state = {
    messages: {},
  }

  componentWillMount() {
    this.props.login();
    this.props.getConfig();
    this.props.getRebloggedList();
    this.props.getRate();
    this.loadMessages();
  }

  /**
   * Load translations messages stored on Steem blockchain using comments:
   * https://busy.org/test/@siol/translations
   */
  loadMessages = () => {
    const path = `/${config.translations.parent_permlink}/@${config.translations.author}/${config
      .translations.permlink}`;
    steemAPI.getState(path, (err, result) => {
      this.setState({ messages: getMessages(result.content) });
    });
  };

  render() {
    const { messages } = this.state;
    const { app, auth } = this.props;
    const locale = getLocale(app.locale, messages);
    let translations = messages[app.locale || locale] || {};
    if (messages.en) {
      translations = { ...messages.en, ...translations };
    }

    return (
      <IntlProvider locale={locale} messages={translations}>
        <GatewayProvider>
          <Layout>
            <Layout.Header style={{ position: 'fixed', width: '100%', zIndex: 5 }}>
              <Topnav username={auth.user.name} />
            </Layout.Header>
            <div className="content">
              {this.props.children}
              <GatewayDest name="tooltip" />
              <GatewayDest name="popover" />
              <GatewayDest name="modal" />
            </div>
          </Layout>
        </GatewayProvider>
      </IntlProvider>
    );
  }
}