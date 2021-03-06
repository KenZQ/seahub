import React from 'react';
import Alert from 'react-s-alert';
import { translate } from "react-i18next";
import '../css/initial-style.css';
import '../css/layout.css';
import '../css/topbar.css';

import RichMarkdownEditor from './rich-markdown-editor';
import PlainMarkdownEditor from './plain-markdown-editor';
import MarkdownViewer from './markdown-viewer';
import { serialize, deserialize } from '../slate2markdown';
const lodash = require('lodash');

class SeafileEditor extends React.Component {


  setFileInfoMtime = () => {
    this.setState({
      fileInfo: Object.assign({}, this.state.fileInfo, {mtime: (new Date().getTime()/1000)})
    });
  };

  constructor(props) {
    super(props);
    this.checkNeedSave = lodash.throttle(this.onCheckNeedSave, 1000);
    this.convertAndCheckNeedSave = lodash.throttle(
      this.convertAndCheckNeedSave, 1000);
    
    this.state = {
      isTreeDataLoaded: false,
      mode: "viewer",
      initialPlainValue: "", // for plain editor
      richValue: deserialize(""),
      // currentContent is markdown object, the root value of viewer, richEditor and plainEditor
      currentContent: this.props.markdownContent,
      savedContent: "",
      contentChanged: false,
      saving: false,
      fileInfo: this.props.fileInfo
    }
  }

  setContent(markdownContent) {
    const value = deserialize(markdownContent);
    this.setState({
      currentContent: markdownContent,
      initialPlainValue: markdownContent,
      richValue: value,
      contentChanged: false,
      savedContent: markdownContent,
    })
  }

  componentDidMount() {
    this.setContent(this.props.markdownContent);
    window.addEventListener("beforeunload", this.onUnload);
  }

  componentWillUnmount() {
    window.removeEventListener("beforeunload", this.onUnload);
  }

  componentWillReceiveProps(nextProps) {
    console.log(nextProps,'will receiveprops');
    // this.setContent(nextProps.markdownContent);
  }

  onUnload = event => {
    if (!this.state.contentChanged) return;
    const confirmationMessage = 'Leave this page? The system may not save your changes.';
    event.returnValue = confirmationMessage;
    return confirmationMessage;
  };

  switchToPlainTextEditor = () => {
    this.setState({
      mode: "plain",
      initialPlainValue: this.state.currentContent
    });
  };

  switchToMarkDownViewer = () => {
    this.setState({
      mode: "viewer"
    })
  };

  switchToRichTextEditor = () => {
    this.setState({
      mode: "rich",
      richValue: deserialize(this.state.currentContent)
    });
  };


  convertAndCheckNeedSave = (newValue) => {
    let currentContent = serialize(newValue.toJSON()).trim();
    let contentChanged = currentContent !== this.state.savedContent.trim();
    this.setState({
      currentContent: currentContent,
      contentChanged: contentChanged
    })
  };

  onCheckNeedSave = (newContent) => {
    this.setState({
      contentChanged: newContent !== this.state.savedContent
    })
  };

  onChange = (change) => {
    if (this.state.mode === 'rich') {
      this.setState({
        richValue: change.value,
      });
      const ops = change.operations
        .filter(o => o.type !== 'set_selection' && o.type !== 'set_value');
      if (ops.size !== 0) {
        // we need to parse change.value to convertAndCheckNeedSave()
        // because after setState, this.state will only be updated
        // at the end of current event loop which may be later
        // than convertAndCheckNeedSave() be called
        this.convertAndCheckNeedSave(change.value);
      }
    } else {
      this.setState({
        currentContent: change,
      });
      // save as above
      this.checkNeedSave(change);
    }
  };

  saveContent = (str) => {
    let promise = this.props.editorUtilities.saveContent(str).then(() => {
      this.setState({
        saving: false,
        savedContent: this.state.currentContent,
        contentChanged: false
      });
      Alert.success(this.props.t('file_saved'), {
            position: 'bottom-right',
            effect: 'scale',
            timeout: 1000
      });
    }, () => {
      this.setState({
        saving: false
      });
      Alert.error(this.props.t('file_failed_to_save'), {
            position: 'bottom-right',
            effect: 'scale',
            timeout: 1000
      });
    });
    this.setState({
      saving: true
    })
  };

  onRichEditorSave = () => {
    const value = this.state.richValue;
    const str = serialize(value.toJSON());
    this.saveContent(str);
    this.setFileInfoMtime();
  };

  onPlainEditorSave = () => {
    const str = this.state.currentContent;
    this.saveContent(str);
    this.setFileInfoMtime();
  };

  render() {

    if (this.state.mode === "rich") {
      return (
        <RichMarkdownEditor
          editorUtilities={this.props.editorUtilities}
          switchToPlainTextEditor={this.switchToPlainTextEditor}
          onChange={this.onChange}
          onSave={this.onRichEditorSave}
          value={this.state.richValue}
          contentChanged={this.state.contentChanged}
          saving={this.state.saving}
          switchToMarkDownViewer={this.switchToMarkDownViewer}
          fileInfo={this.state.fileInfo}
        />
      );
    } else if (this.state.mode === "plain") {
      return (
        <PlainMarkdownEditor
          editorUtilities={this.props.editorUtilities}
          initialValue={this.state.initialPlainValue}
          currentContent={this.state.currentContent}
          contentChanged={this.state.contentChanged}
          saving={this.state.saving}
          switchToRichTextEditor={this.switchToRichTextEditor}
          onSave={this.onPlainEditorSave}
          onChange={this.onChange}
          fileInfo={this.state.fileInfo}
        />
      );
    } else if (this.state.mode === "viewer") {
      return (
        <MarkdownViewer
          fileInfo={this.state.fileInfo}
          markdownContent={this.state.currentContent}
          switchToEditor={this.switchToRichTextEditor}
          editorUtilities={this.props.editorUtilities}
        />
      )
    }
  }
}

export default translate("translations")(SeafileEditor);
