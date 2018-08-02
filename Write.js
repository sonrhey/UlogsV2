import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Route, Switch, withRouter } from 'react-router-dom';
import { replace } from 'react-router-redux';
import _ from 'lodash';
import 'url-search-params-polyfill';
import { injectIntl } from 'react-intl';
import uuidv4 from 'uuid/v4';
import { getHtml } from '../../components/Story/Body';
import VideoEmbed from '../../components/Sidebar/VideoEmbed';
import improve from '../../helpers/improve';
import { extractLinks } from '../../helpers/parser';
import { getContentImages } from '../../helpers/postHelpers';
import { rewardsValues } from '../../../common/constants/rewards';
import LastDraftsContainer from './LastDraftsContainer';
import DeleteDraftModal from './DeleteDraftModal';

import {
  getAuthenticatedUser,
  getDraftPosts,
  getIsEditorLoading,
  getIsEditorSaving,
  getUpvoteSetting,
  getRewardSetting,
} from '../../reducers';

import { createPost, saveDraft, newPost } from './editorActions';
import Editor from '../../components/Editor/Editor';
import EditorMain from '../../components/Editor/EditorMain';
import EditorTeardrop from '../../components/Editor/EditorTeardrop';
import EditorUntalented from '../../components/Editor/EditorUntalented';
import EditorUlogNed from '../../components/Editor/EditorUlogNed';
import EditorBeLikeTerry from '../../components/Editor/EditorBeLikeTerry';
import EditorSurpassingGoogle from '../../components/Editor/EditorSurpassingGoogle';
import Affix from '../../components/Utils/Affix';

const version = require('../../../../package.json').version;

@injectIntl
@withRouter
@connect(
  (state, props) => ({
    user: getAuthenticatedUser(state),
    draftPosts: getDraftPosts(state),
    loading: getIsEditorLoading(state),
    saving: getIsEditorSaving(state),
    draftId: new URLSearchParams(props.location.search).get('draft'),
    upvoteSetting: getUpvoteSetting(state),
    rewardSetting: getRewardSetting(state),
  }),
  {
    createPost,
    saveDraft,
    newPost,
    replace,
  },
)
class Write extends React.Component {
  static propTypes = {
    user: PropTypes.shape().isRequired,
    draftPosts: PropTypes.shape().isRequired,
    loading: PropTypes.bool.isRequired,
    intl: PropTypes.shape().isRequired,
    saving: PropTypes.bool,
    draftId: PropTypes.string,
    upvoteSetting: PropTypes.bool,
    rewardSetting: PropTypes.string,
    newPost: PropTypes.func,
    createPost: PropTypes.func,
    saveDraft: PropTypes.func,
    replace: PropTypes.func,
  };

  static defaultProps = {
    saving: false,
    draftId: null,
    upvoteSetting: true,
    rewardSetting: rewardsValues.half,
    newPost: () => {},
    createPost: () => {},
    saveDraft: () => {},
    notify: () => {},
    replace: () => {},
  };

  constructor(props) {
    super(props);
    this.state = {
      initialTitle: '',
      initialTopics: [],
      initialBody: '',
      initialReward: this.props.rewardSetting,
      initialUpvote: this.props.upvoteSetting,
      initialUpdatedDate: Date.now(),
      isUpdating: false,
      showModalDelete: false,
    };
  }

  componentDidMount() {
    this.props.newPost();
    const { draftPosts, draftId } = this.props;
    const draftPost = draftPosts[draftId];

    if (draftPost) {
      let tags = [];
      if (_.isArray(draftPost.jsonMetadata.tags)) {
        tags = draftPost.jsonMetadata.tags;
      }

      if (draftPost.permlink) {
        this.permlink = draftPost.permlink;
      }

      if (draftPost.originalBody) {
        this.originalBody = draftPost.originalBody;
      }

      // eslint-disable-next-line
      this.setState({
        initialTitle: draftPost.title || '',
        initialTopics: tags || [],
        initialBody: draftPost.body || '',
        initialReward: draftPost.reward,
        initialUpvote: draftPost.upvote,
        initialUpdatedDate: draftPost.lastUpdated || Date.now(),
        isUpdating: draftPost.isUpdating || false,
      });
    }

    if (draftId) {
      this.draftId = draftId;
    } else {
      this.draftId = uuidv4();
    }
  }

  componentWillReceiveProps(nextProps) {
    const newDraft = nextProps.draftId === null;
    const differentDraft = this.props.draftId !== nextProps.draftId;
    if (differentDraft && newDraft) {
      this.draftId = uuidv4();
      this.setState({
        initialTitle: '',
        initialTopics: [],
        initialBody: '',
        initialReward: rewardsValues.half,
        initialUpvote: nextProps.upvoteSetting,
        initialUpdatedDate: Date.now(),
        isUpdating: false,
        showModalDelete: false,
      });
    } else if (differentDraft) {
      const { draftPosts, draftId } = nextProps;
      const draftPost = _.get(draftPosts, draftId, {});
      const initialTitle = _.get(draftPost, 'title', '');
      const initialBody = _.get(draftPost, 'body', '');
      const initialTopics = _.get(draftPost, 'jsonMetadata.tags', []);
      this.draftId = draftId;
      this.setState({
        initialTitle,
        initialBody,
        initialTopics,
      });
    }
  }

  componentDidUpdate(prevProps) {
    if (_.get(this.props, 'location.search') !== _.get(prevProps, 'location.search')) {
      this.saveDraft.cancel();
    }
  }

  onDeleteDraft = () => this.props.replace('/editor');

  onDelete = () => this.setState({ showModalDelete: true });

  onSubmit = form => {
    const data = this.getNewPostData(form);
    data.body = improve(data.body);
    if (this.props.draftId) {
      data.draftId = this.props.draftId;
    }
    this.props.createPost(data);
  };

  getNewPostData = form => {
    const data = {
      body: form.body,
      title: form.title,
      reward: form.reward,
      upvote: form.upvote,
      lastUpdated: Date.now(),
    };

    data.parentAuthor = '';
    data.author = this.props.user.name || '';

    const tags = form.topics;
    const users = [];
    const userRegex = /@([a-zA-Z.0-9-]+)/g;
    let matches;

    const postBody = data.body;

    // eslint-disable-next-line
    while ((matches = userRegex.exec(postBody))) {
      if (users.indexOf(matches[1]) === -1) {
        users.push(matches[1]);
      }
    }

    const parsedBody = getHtml(postBody, {}, 'text');

    const images = getContentImages(parsedBody, true);
    const links = extractLinks(parsedBody);

    if (data.title && !this.permlink) {
      data.permlink = _.kebabCase(data.title);
    } else {
      data.permlink = this.permlink;
    }

    if (this.state.isUpdating) data.isUpdating = this.state.isUpdating;

    let metaData = {
      community: 'ulogs',
      app: `ulogs/${version}`,
      format: 'markdown',
    };

    // Merging jsonMetadata makes sure that users don't lose any metadata when they edit post using
    // Busy (like video data from DTube)
    if (this.props.draftPosts[this.draftId] && this.props.draftPosts[this.draftId].jsonMetadata) {
      metaData = {
        ...this.props.draftPosts[this.draftId].jsonMetadata,
        ...metaData,
      };
    }

    if (tags.length) {
      metaData.tags = tags;
    }
    if (users.length) {
      metaData.users = users;
    }
    if (links.length) {
      metaData.links = links.slice(0, 10);
    }
    if (images.length) {
      metaData.image = images;
    }

    data.parentPermlink = tags.length ? tags[0] : 'general';
    data.jsonMetadata = metaData;

    if (this.originalBody) {
      data.originalBody = this.originalBody;
    }

    return data;
  };

  handleCancelDeleteDraft = () => this.setState({ showModalDelete: false });

  saveDraft = _.debounce(form => {
    if (this.props.saving) return;

    const data = this.getNewPostData(form);
    const postBody = data.body;
    const id = this.props.draftId;
    // Remove zero width space
    const isBodyEmpty = postBody.replace(/[\u200B-\u200D\uFEFF]/g, '').trim().length === 0;

    if (isBodyEmpty) return;

    const redirect = id !== this.draftId;
    const editorUrl = this.props.location.pathname.split('/')[1];

    this.props.saveDraft({ postData: data, id: this.draftId, editorUrl: editorUrl }, redirect, this.props.intl);
  }, 2000);

  render() {
    const { initialTitle, initialTopics, initialBody, initialReward, initialUpvote } = this.state;
    const { loading, saving, draftId } = this.props;

    return (
      <div className="shifted">
        <div className="post-layout container">
          <Affix className="rightContainer" stickPosition={77}>
            <div className="right">
              <LastDraftsContainer />
              <Switch>
                <Route
                  path="/main-editor"
                  render={() => (
                    <VideoEmbed key="embed"
                      embed={{
                        provider_name: 'YouTube',
                        thumbnail: 'https://steemitimages.com/360x203/https://img.youtube.com/vi/kKZ1CixLG2s/0.jpg',
                        embed: '<iframe width="270" height="158" src="https://www.youtube.com/embed/kKZ1CixLG2s?autoplay=1&amp;autohide=1&amp;enablejsapi=0&amp;rel=0&amp;origin=https://steemit.com" frameborder="0" allowfullscreen=""></iframe>',
                      }}
                    />
                  )}
                />
                <Route render={() => (
                    <VideoEmbed key="embed"
                      embed={{
                        provider_name: 'YouTube',
                        thumbnail: 'https://steemitimages.com/360x203/https://img.youtube.com/vi/kKZ1CixLG2s/0.jpg',
                        embed: '<iframe width="270" height="158" src="https://www.youtube.com/embed/kKZ1CixLG2s?autoplay=1&amp;autohide=1&amp;enablejsapi=0&amp;rel=0&amp;origin=https://steemit.com" frameborder="0" allowfullscreen=""></iframe>',
                      }}
                    />
                )} />
              </Switch>
            </div>
          </Affix>
          <div className="center">
            <Switch>
              <Route
                path="/main-editor"
                render={() => (
                  <EditorMain
                    ref={this.setForm}
                    saving={saving}
                    title={initialTitle}
                    topics={initialTopics}
                    body={initialBody}
                    reward={initialReward}
                    upvote={initialUpvote}
                    draftId={draftId}
                    loading={loading}
                    isUpdating={this.state.isUpdating}
                    onUpdate={this.saveDraft}
                    onSubmit={this.onSubmit}
                    onDelete={this.onDelete}
                  />
                )}
              />
              <Route
                path="/teardrops"
                render={() => (
                  <EditorTeardrop
                    ref={this.setForm}
                    saving={saving}
                    title={initialTitle}
                    topics={initialTopics}
                    body={initialBody}
                    reward={initialReward}
                    upvote={initialUpvote}
                    draftId={draftId}
                    loading={loading}
                    isUpdating={this.state.isUpdating}
                    onUpdate={this.saveDraft}
                    onSubmit={this.onSubmit}
                    onDelete={this.onDelete}
                  />
                )}
              />
              <Route
                path="/untalented"
                render={() => (
                  <EditorUntalented
                    ref={this.setForm}
                    saving={saving}
                    title={initialTitle}
                    topics={initialTopics}
                    body={initialBody}
                    reward={initialReward}
                    upvote={initialUpvote}
                    draftId={draftId}
                    loading={loading}
                    isUpdating={this.state.isUpdating}
                    onUpdate={this.saveDraft}
                    onSubmit={this.onSubmit}
                    onDelete={this.onDelete}
                  />
                )}
              />
              <Route
                path="/surpassinggoogle"
                render={() => (
                  <EditorBeLikeTerry
                    ref={this.setForm}
                    saving={saving}
                    title={initialTitle}
                    topics={initialTopics}
                    body={initialBody}
                    reward={initialReward}
                    upvote={initialUpvote}
                    draftId={draftId}
                    loading={loading}
                    isUpdating={this.state.isUpdating}
                    onUpdate={this.saveDraft}
                    onSubmit={this.onSubmit}
                    onDelete={this.onDelete}
                  />
                )}
              />
              <Route
                path="/ulog-ned"
                render={() => (
                  <EditorUlogNed
                    ref={this.setForm}
                    saving={saving}
                    title={initialTitle}
                    topics={initialTopics}
                    body={initialBody}
                    reward={initialReward}
                    upvote={initialUpvote}
                    draftId={draftId}
                    loading={loading}
                    isUpdating={this.state.isUpdating}
                    onUpdate={this.saveDraft}
                    onSubmit={this.onSubmit}
                    onDelete={this.onDelete}
                  />
                )}
              />
              <Route render={() => (
                  <Editor
                    ref={this.setForm}
                    saving={saving}
                    title={initialTitle}
                    topics={initialTopics}
                    body={initialBody}
                    reward={initialReward}
                    upvote={initialUpvote}
                    draftId={draftId}
                    loading={loading}
                    isUpdating={this.state.isUpdating}
                    onUpdate={this.saveDraft}
                    onSubmit={this.onSubmit}
                    onDelete={this.onDelete}
                  />
              )} />
            </Switch>
          </div>
          {this.state.showModalDelete && (
            <DeleteDraftModal
              draftIds={[draftId]}
              onDelete={this.onDeleteDraft}
              onCancel={this.handleCancelDeleteDraft}
            />
          )}
        </div>
      </div>
    );
  }
}

export default Write;